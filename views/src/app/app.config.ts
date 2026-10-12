import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './core/api/api.providers';
import { authInterceptor } from './core/auth/auth.interceptor';
import { SessionService } from './core/auth/session.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Mock or real API, decided by environment.useMockApi.
    ...provideApi(),
    // Restore the signed-in user (page refresh) before the first route guard runs.
    provideAppInitializer(() => inject(SessionService).restore()),
  ],
};
