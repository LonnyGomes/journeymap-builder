# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Angular 20 application called "journeymap-builder" built with standalone components, signals-based state management, and zoneless change detection. The project uses TypeScript with strict type checking and SCSS for styling.

## Development Commands

### Running the Application
```bash
npm start              # Start development server on http://localhost:4200
ng serve              # Alternative to npm start
```

### Building
```bash
npm run build         # Production build (outputs to dist/)
npm run watch         # Development build with file watching
ng build              # Same as npm run build
```

### Testing
```bash
npm test              # Run unit tests with Karma
ng test               # Alternative to npm test
```

The test runner uses Karma with Jasmine. Tests run in Chrome by default.

### Code Generation
```bash
ng generate component component-name    # Generate a new component
ng generate service service-name        # Generate a new service
ng generate --help                      # List all available schematics
```

## Architecture

### Application Bootstrap
- Entry point: `src/main.ts` - bootstraps the application using `bootstrapApplication()`
- Root component: `src/app/app.ts` - named `App` (not `AppComponent`)
- Application config: `src/app/app.config.ts` - provides zoneless change detection and router

### Zoneless Change Detection
This application uses Angular's zoneless change detection (`provideZonelessChangeDetection()`), which means:
- No Zone.js dependency
- Change detection is triggered by signals, observables with async pipe, or manual calls
- All state should be managed with signals for reactivity

### Routing
- Routes are defined in `src/app/app.routes.ts`
- Currently empty - ready for feature routes to be added
- Use lazy loading for feature modules when adding routes

### Styling
- Global styles: `src/styles.scss`
- Component styles use SCSS (configured in angular.json)
- Component style file naming: `component-name.scss` (not `component-name.component.scss`)

### Component Naming Convention
- Components are named without the "Component" suffix (e.g., `App` instead of `AppComponent`)
- Files follow the pattern: `component-name.ts`, `component-name.html`, `component-name.scss`
- Template files: `templateUrl: './component-name.html'`
- Style files: `styleUrl: './component-name.scss'` (singular, not `styleUrls`)

### TypeScript Configuration
- **Strict mode enabled** - all strict TypeScript checks are on
- Additional strict flags:
  - `noImplicitOverride: true`
  - `noPropertyAccessFromIndexSignature: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
- Experimental decorators enabled for Angular
- Target: ES2022
- Strict Angular template checking enabled

### Code Style
- Prettier is configured in package.json
- Print width: 100 characters
- Single quotes enabled
- HTML files use Angular parser

## Angular-Specific Patterns

### Standalone Components (Default)
- All components are standalone by default
- Do NOT set `standalone: true` in decorators
- Import dependencies directly in the component's `imports` array

### Signals for State Management
- Use `signal()` for component state
- Use `computed()` for derived state
- Use `update()` or `set()` to modify signals (NOT `mutate`)

### Modern Control Flow
- Use `@if`, `@for`, `@switch` in templates (NOT `*ngIf`, `*ngFor`, `*ngSwitch`)

### Dependency Injection
- Use `inject()` function instead of constructor injection
- Services use `providedIn: 'root'` for singleton behavior

### Forms
- Prefer Reactive Forms over Template-driven forms

### Host Bindings
- Use `host` object in `@Component` or `@Directive` decorator
- Do NOT use `@HostBinding` and `@HostListener` decorators

### Change Detection
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in all components

### Class Bindings
- Use `[class.className]` bindings instead of `ngClass`
- Use `[style.property]` bindings instead of `ngStyle`

### Images
- Use `NgOptimizedImage` for static images
- Note: `NgOptimizedImage` does not work for inline base64 images

## Build Configuration

### Production Build Budgets
- Initial bundle: 500kB warning, 1MB error
- Component styles: 4kB warning, 8kB error

### Static Assets
- Place static files in the `public/` directory
- They will be copied to the output directory during build

## Git
- always use conventional commits
