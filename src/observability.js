import * as Sentry from '@sentry/react';

export const sentryEnabled = Boolean(import.meta.env.VITE_SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      if (event.request) delete event.request.data;
      return event;
    },
  });
}

export { Sentry };
