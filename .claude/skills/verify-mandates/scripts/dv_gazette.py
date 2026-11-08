"""Държавен вестник (dv.parliament.bg) reader — class-1 artifact source.

The official gazette publishes every указ, решение на НС and наредба, so it is
where appointment instruments and ministerial signature blocks actually live.
The site is a MyFaces app with no documented API; this module drives it.

    op, vs = session()
    iss, n, _ = issues(op, vs, keyword='физическото възпитание',
                       frm='20.09.2024', to='30.09.2024')   # dd.mm.yyyy
    mats, _   = contents(op, vs, iss[0])                    # [(idMat, linktext)]
    text      = material(op, mats[0][0])                    # full act text

Verified mechanics (do not "simplify" these away):
  * btnFind11 is <input type="image"> — it MUST be submitted as
    `broi_form:btnFind11.x/.y`; sending it as a named value returns 200 with
    zero rows and looks like "no results".
  * ViewState is read from the LAST javax.faces.ViewState on the page.
  * Drill-down is a dataTable command link: pass `broi_form:_idcl` plus
    broi_/idObj/date_izd_/razdel_.

Known limits, confirmed by probe:
  * `contents()` reads razdel_=1 (официален раздел) only. Keyword hits in the
    неофициален раздел will not appear in its material list — pass razdel_='2'
    if a search hit cannot be located.
  * Multi-word keywords are NOT reliable phrase matching: in one window
    'Мирослав'=8, 'Рашков'=6, 'Мирослав Рашков'=6. Search one distinctive term
    and confirm by reading the material text.
  * A surname alone collects namesakes — 'Рашков' in early 2024 is Бойко
    Рашков (вътрешен министър), not Мирослав Рашков. Always read the text.
  * Results paginate 10 issues per page; `n` is the true total.
  * Issues before 2003 are reachable only through this date filter.
"""

import re, html, urllib.parse, urllib.request, http.cookiejar
BASE='https://dv.parliament.bg/DVWeb/broeveList.faces'
MAT='https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat='

def session():
    cj=http.cookiejar.CookieJar()
    op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders=[('User-Agent','research-client'),('Content-Type','application/x-www-form-urlencoded')]
    s=op.open(BASE, timeout=45).read().decode('utf-8','replace')
    return op, re.findall(r'name="javax\.faces\.ViewState"[^>]*value="([^"]+)"', s)[-1]

def post(op, vs, extra):
    d={'active_tab':'2','broi_form:not_first':'1','broi_form:_idJsp61':'','broi_form:_idJsp67':'',
       'broi_form:from_date':'','broi_form:to_date':'','broi_form_SUBMIT':'1',
       'broi_form:_link_hidden_':'','broi_form:_idcl':'',
       'date_izd_':'','id_':'','idObj':'','razdel_':'','broi_':'','javax.faces.ViewState':vs}
    d.update(extra)
    r=op.open(BASE, data=urllib.parse.urlencode(d, encoding='utf-8').encode(), timeout=90)
    return r.read().decode('utf-8','replace')

def issues(op, vs, keyword='', frm='', to=''):
    """Issues whose official section contains `keyword`, within a date window."""
    t=post(op, vs, {'broi_form:_idJsp61':keyword,'broi_form:from_date':frm,'broi_form:to_date':to,
                    'broi_form:btnFind11.x':'12','broi_form:btnFind11.y':'10'})
    out=[]
    for m in re.finditer(r"oamSubmitForm\('broi_form','(broi_form:dataTable1:\d+:_idJsp101)',null,\[\['broi_','(\d+)'\],\['idObj','(\d+)'\],\['date_izd_','([\d-]+)'\]", t):
        out.append({'cmd':m.group(1),'broi':m.group(2),'idObj':m.group(3),'date':m.group(4)})
    n=re.search(r'Намерени резултати:\s*(\d+)', html.unescape(re.sub('<[^>]+>',' ',t)))
    return out, (int(n.group(1)) if n else 0), t

def contents(op, vs, iss, razdel=('1','2')):
    """Material ids of an issue. razdel: '1'=официален, '2'=неофициален.

    Defaults to both — a keyword hit is often in the неофициален раздел, and
    fetching only раздел 1 makes such a hit look like it does not exist."""
    if isinstance(razdel, str): razdel=(razdel,)
    mats, last = [], ''
    for r in razdel:
        last=post(op, vs, {'broi_form:_idcl':iss['cmd'],'broi_':iss['broi'],'idObj':iss['idObj'],
                           'date_izd_':iss['date'],'razdel_':r})
        for m in re.finditer(r'idMat=(\d+)', last):
            if m.group(1) not in [x[0] for x in mats]:
                mats.append((m.group(1), r))
    return mats, last

def material(op, idmat):
    t=op.open(MAT+str(idmat), timeout=60).read().decode('utf-8','replace')
    t=re.sub(r'<script.*?</script>','',t,flags=re.S)
    txt=html.unescape(re.sub('<[^>]+>','\n',t))
    return '\n'.join(l.strip() for l in txt.split('\n') if l.strip())
