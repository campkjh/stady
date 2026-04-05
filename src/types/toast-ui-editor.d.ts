declare module "@toast-ui/editor" {
  interface EditorOptions {
    el: HTMLElement;
    height?: string;
    initialEditType?: "markdown" | "wysiwyg";
    placeholder?: string;
    hideModeSwitch?: boolean;
    toolbarItems?: (string | string[])[];
  }

  export default class Editor {
    constructor(options: EditorOptions);
    getHTML(): string;
    setHTML(html: string): void;
    getMarkdown(): string;
    destroy(): void;
  }
}

declare module "@toast-ui/editor/dist/toastui-editor.css";
