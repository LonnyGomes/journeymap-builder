import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
  SecurityContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-editable-cell',
  templateUrl: './editable-cell.html',
  styleUrl: './editable-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditableCell {
  readonly value = input<string>('');
  readonly placeholder = input<string>('Click to edit...');
  readonly multiline = input<boolean>(true);
  readonly minRows = input<number>(2);
  readonly renderMarkdown = input<boolean>(false);

  readonly valueChange = output<string>();

  protected readonly isEditing = signal(false);
  protected readonly editValue = signal('');
  protected readonly renderedValue = computed(() => this.parseMarkdown(this.value()));

  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    marked.setOptions({
      breaks: true,
      gfm: false,
    });
  }

  protected startEditing(): void {
    this.editValue.set(this.value());
    this.isEditing.set(true);
    setTimeout(() => {
      const textarea = this.textareaRef()?.nativeElement;
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    });
  }

  protected saveAndClose(): void {
    const newValue = this.editValue().trim();
    if (newValue !== this.value()) {
      this.valueChange.emit(newValue);
    }
    this.isEditing.set(false);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isEditing.set(false);
    } else if (event.key === 'Enter' && !this.multiline()) {
      event.preventDefault();
      this.saveAndClose();
    } else if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault();
      this.saveAndClose();
    }
  }

  protected updateValue(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.editValue.set(target.value);
  }

  private parseMarkdown(value: string): string {
    if (!value || !this.renderMarkdown()) {
      return value;
    }

    const rawHtml = marked.parse(value, { async: false }) as string;
    const htmlWithSafeLinks = rawHtml.replace(
      /<a\s+(?![^>]*\btarget=)(?![^>]*\brel=)([^>]*?)>/gim,
      '<a target="_blank" rel="noopener noreferrer" $1>',
    );

    const htmlWithTargetOnly = htmlWithSafeLinks.replace(
      /<a\s+(?![^>]*\btarget=)([^>]*?\brel=(["'])[^"']*\2[^>]*?)>/gim,
      '<a target="_blank" $1>',
    );

    const safeHtml = htmlWithTargetOnly.replace(
      /<a\s+(?![^>]*\brel=)([^>]*?\btarget=(["'])[^"']*\2[^>]*?)>/gim,
      '<a rel="noopener noreferrer" $1>',
    );
    return this.sanitizer.sanitize(SecurityContext.HTML, safeHtml) ?? '';
  }
}
