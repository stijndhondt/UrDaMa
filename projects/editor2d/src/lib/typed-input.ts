/**
 * The typed-value overlay (Box-drawing interaction): small fields next to the cursor.
 * Tab moves between fields, Enter places, Esc cancels. Typing into it never reaches the plan.
 */
export interface TypedField {
  readonly label: string;
  readonly value?: string;
  /** A choice instead of a typed value; `value` is the chosen option's value. */
  readonly options?: readonly { readonly value: string; readonly label: string }[];
}

export interface TypedInputHandlers {
  readonly change: (values: readonly string[]) => void;
  readonly commit: (values: readonly string[]) => void;
  readonly cancel: () => void;
}

export class TypedInput {
  private readonly root: HTMLDivElement;
  private inputs: (HTMLInputElement | HTMLSelectElement)[] = [];
  private handlers: TypedInputHandlers | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'lk-typed-input';
    Object.assign(this.root.style, {
      position: 'absolute',
      display: 'none',
      gap: '8px',
      alignItems: 'flex-end',
      padding: '8px',
      background: '#fff',
      border: '1px solid #2f6fde',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      zIndex: '5',
      font: '12px system-ui, sans-serif',
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.handlers !== null;
  }

  values(): string[] {
    return this.inputs.map((i) => i.value);
  }

  /** Opens the fields at a screen position; `first` is the key that started typing. */
  open(
    fields: readonly TypedField[],
    at: { x: number; y: number },
    handlers: TypedInputHandlers,
    first = '',
  ): void {
    this.close();
    this.handlers = handlers;
    this.root.replaceChildren();
    this.inputs = fields.map((field, i) => {
      const label = document.createElement('label');
      Object.assign(label.style, { display: 'flex', flexDirection: 'column', color: '#6b7280' });
      label.textContent = field.label;
      const input = field.options ? this.choice(field) : this.text(field, i === 0 ? first : '');
      const element: HTMLElement = input;
      element.addEventListener(field.options ? 'change' : 'input', () =>
        this.handlers?.change(this.values()),
      );
      element.addEventListener('keydown', (e) => this.onKey(e, i));
      label.appendChild(input);
      this.root.appendChild(label);
      return input;
    });
    this.root.style.left = `${Math.max(4, at.x + 16)}px`;
    this.root.style.top = `${Math.max(4, at.y + 16)}px`;
    this.root.style.display = 'flex';
    const firstInput = this.inputs[0];
    if (firstInput) {
      firstInput.focus();
      if (firstInput instanceof HTMLInputElement) {
        firstInput.setSelectionRange(0, firstInput.value.length);
        if (first) firstInput.setSelectionRange(firstInput.value.length, firstInput.value.length);
      }
    }
    this.handlers.change(this.values());
  }

  private text(field: TypedField, first: string): HTMLInputElement {
    const input = document.createElement('input');
    Object.assign(input.style, {
      width: '84px',
      font: '600 14px system-ui, sans-serif',
      padding: '3px 5px',
    });
    input.value = first + (field.value ?? '');
    input.autocomplete = 'off';
    return input;
  }

  private choice(field: TypedField): HTMLSelectElement {
    const select = document.createElement('select');
    Object.assign(select.style, { font: '13px system-ui, sans-serif', padding: '3px 4px' });
    for (const o of field.options ?? []) {
      const option = document.createElement('option');
      option.value = o.value;
      option.textContent = o.label;
      option.selected = o.value === field.value;
      select.appendChild(option);
    }
    return select;
  }

  close(): void {
    this.handlers = null;
    this.inputs = [];
    this.root.style.display = 'none';
    this.root.replaceChildren();
  }

  destroy(): void {
    this.close();
    this.root.remove();
  }

  private onKey(e: KeyboardEvent, index: number): void {
    e.stopPropagation();
    const handlers = this.handlers;
    if (!handlers) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const values = this.values();
      this.close();
      handlers.commit(values);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      handlers.cancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const next =
        this.inputs[(index + (e.shiftKey ? -1 : 1) + this.inputs.length) % this.inputs.length];
      next?.focus();
      if (next instanceof HTMLInputElement) next.select();
    }
  }
}
