import { bootstrapApplication } from '@angular/platform-browser';
import moment from 'moment';
import 'moment/locale/bg';
import { appConfig } from './app/app.config';
import { App } from './app/app';

moment.locale('bg');

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
