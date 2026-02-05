import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
} from '@angular/core';

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

  readonly valueChange = output<string>();

  protected readonly isEditing = signal(false);
  protected readonly editValue = signal('');

  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

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
}
