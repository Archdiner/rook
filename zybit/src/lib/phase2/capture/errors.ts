/**
 * JS error and console message capture.
 *
 * Wires up pageerror + console Playwright listeners before navigation.
 * Only captures console warn/error to keep the array from bloating on
 * chatty sites. Errors are capped at 100, console messages at 200.
 */

import type { Page, ConsoleMessage as PlaywrightConsole } from 'playwright-core';
import type { ConsoleMessage, JsError } from './types';

const MAX_ERRORS = 100;
const MAX_CONSOLE = 200;

export function createErrorLog(page: Page) {
  const errors: JsError[] = [];
  const messages: ConsoleMessage[] = [];

  const onPageError = (err: Error) => {
    if (errors.length >= MAX_ERRORS) return;
    errors.push({
      message: err.message.slice(0, 500),
      type: err.name,
      stack: err.stack?.slice(0, 1000) ?? null,
      url: null,
      line: null,
    });
  };

  const onConsole = (msg: PlaywrightConsole) => {
    if (messages.length >= MAX_CONSOLE) return;
    const type = msg.type();
    // Surface only noise-worthy entries; skip info/log/debug
    // Playwright uses 'warning' (not 'warn') for the warning level
    if (type !== 'warning' && type !== 'error') return;
    messages.push({
      level: type === 'warning' ? 'warn' : type as ConsoleMessage['level'],
      text: msg.text().slice(0, 500),
      url: null,
      line: null,
    });
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  return {
    getErrors: () => errors,
    getConsoleMessages: () => messages,
    cleanup() {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
    },
  };
}
