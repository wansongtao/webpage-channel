import type { IWebpageChannelAdapter } from '../types';

export default class PostMessageAdapter implements IWebpageChannelAdapter {
  private targetWindow: Window;
  private targetOrigin: string;

  constructor(targetWindow: Window, targetOrigin: string) {
    this.targetWindow = targetWindow;
    this.targetOrigin = targetOrigin;
  }

  postMessage(message: string) {
    this.targetWindow.postMessage(message, this.targetOrigin);
  }

  onMessage(callback: (message: string) => void) {
    window.addEventListener('message', (e) => {
      if (e.origin === this.targetOrigin) {
        callback(e.data);
      }
    });
  }

  onMessageError(callback: (e: MessageEvent) => void) {
    window.addEventListener('messageerror', callback);
  }

  close() {
    // No specific cleanup needed for postMessage
  }
}