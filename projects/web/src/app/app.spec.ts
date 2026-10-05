import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { PlanEditorComponent } from './editor/plan-editor.component';

@Component({ selector: 'lk-plan-editor', template: '' })
class PlanEditorStub {
  readonly label = input('');
}

describe('App shell', () => {
  // jsdom has no matchMedia (the theme follows the OS).
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  // jsdom has no ResizeObserver either (Optimus's tab list measures itself).
  globalThis.ResizeObserver ??= class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  } as unknown as typeof ResizeObserver;

  async function render() {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideTranslateService({ lang: 'en' })],
    })
      .overrideComponent(App, {
        remove: { imports: [PlanEditorComponent] },
        add: { imports: [PlanEditorStub] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the brand, the Room tool and the status bar', async () => {
    const { el } = await render();
    expect(el.querySelector('.brand')?.textContent).toContain('Urdama');
    expect(el.querySelectorAll('lk-plan-toolbar p-selectbutton').length).toBeGreaterThan(0);
    expect(el.querySelector('.status')).not.toBeNull();
  });

  it('shows the Quantities instead of the drawing, and the drawing again', async () => {
    const { fixture, el } = await render();
    expect(el.querySelector('.quantities-page')).toBeNull();
    const tab = (text: string) =>
      [...el.querySelectorAll<HTMLElement>('.pages p-tab')].find((t) =>
        t.textContent?.includes(text),
      )!;
    tab('quantities.title').click();
    await fixture.whenStable();
    expect(el.querySelector('.quantities-page')).not.toBeNull();
    tab('shell.drawing').click();
    await fixture.whenStable();
    expect(el.querySelector('.quantities-page')).toBeNull();
  });
});
