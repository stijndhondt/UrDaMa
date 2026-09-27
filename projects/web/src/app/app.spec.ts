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

  it('shows the brand, the Room tool and the status bar', async () => {
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
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand')?.textContent).toContain('Lakudemis');
    expect(el.querySelectorAll('lk-plan-toolbar button').length).toBeGreaterThan(0);
    expect(el.querySelector('.status')).not.toBeNull();
  });
});
