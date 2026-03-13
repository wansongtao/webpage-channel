import type { IWebpageChannelAdapter } from '../types';

export default class PostMessageAdapter implements IWebpageChannelAdapter {
  private targetWindow: Window;
  private targetOrigin: string;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private messageErrorHandler: ((e: MessageEvent) => void) | null = null;

  constructor(targetWindow: Window, targetOrigin: string) {
    this.targetWindow = targetWindow;
    this.targetOrigin = targetOrigin;
  }

  postMessage(message: string) {
    this.targetWindow.postMessage(message, this.targetOrigin);
  }

  onMessage(callback: (message: string) => void) {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }

    this.messageHandler = (e) => {
      if (e.origin === this.targetOrigin && e.source === this.targetWindow) {
        callback(e.data);
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  onMessageError(callback: (e: MessageEvent) => void) {
    if (this.messageErrorHandler) {
      window.removeEventListener('messageerror', this.messageErrorHandler);
    }

    this.messageErrorHandler = callback;
    window.addEventListener('messageerror', this.messageErrorHandler);
  }

  close() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    if (this.messageErrorHandler) {
      window.removeEventListener('messageerror', this.messageErrorHandler);
      this.messageErrorHandler = null;
    }
  }
}
