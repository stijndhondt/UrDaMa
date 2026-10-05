import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { PanelSectionComponent } from './panel-section.component';

@Component({
  imports: [PanelSectionComponent],
  template: `
    <lk-panel-section [key]="key()" heading="Sizes">
      <p class="content">Length 3.300 m</p>
    </lk-panel-section>
  `,
})
class HostComponent {
  readonly key = input('sizes');
}

describe('Properties panel sections (ticket 29)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideTranslateService({ lang: 'en' })],
    }).compileComponents();
  });

  async function render(key = 'sizes') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentRef.setInput('key', key);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      header: () => el.querySelector<HTMLButtonElement>('button')!,
      content: () => el.querySelector('.content'),
    };
  }

  it('is open at first and folds and unfolds from its header', async () => {
    const { fixture, header, content } = await render();
    expect(content()).not.toBeNull();
    expect(header().getAttribute('aria-expanded')).toBe('true');
    header().click();
    await fixture.whenStable();
    expect(content()).toBeNull();
    expect(header().getAttribute('aria-expanded')).toBe('false');
    header().click();
    await fixture.whenStable();
    expect(content()).not.toBeNull();
  });

  it('stays folded after a reload, per section', async () => {
    const first = await render();
    first.header().click();
    await first.fixture.whenStable();
    first.fixture.destroy();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideTranslateService({ lang: 'en' })],
    }).compileComponents();
    expect((await render()).content()).toBeNull();
    expect((await render('faces')).content()).not.toBeNull();
  });
});
