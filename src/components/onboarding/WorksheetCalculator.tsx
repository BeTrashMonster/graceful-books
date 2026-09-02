/**
 * WorksheetCalculator Component
 *
 * Simple arithmetic calculator for quick calculations while filling out the worksheet.
 * Supports basic operations: +, -, *, /
 */

import { useState, useCallback } from 'react';
import styles from './WorksheetCalculator.module.css';

export function WorksheetCalculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback((digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  }, [display, waitingForOperand]);

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }

    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  }, []);

  const performOperation = useCallback((nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue;
      let newValue: number;

      switch (operation) {
        case '+':
          newValue = currentValue + inputValue;
          break;
        case '-':
          newValue = currentValue - inputValue;
          break;
        case '*':
          newValue = currentValue * inputValue;
          break;
        case '/':
          newValue = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        default:
          newValue = inputValue;
      }

      // Round to avoid floating point issues
      newValue = Math.round(newValue * 1000000) / 1000000;
      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  }, [display, operation, previousValue]);

  const calculate = useCallback(() => {
    if (operation === null || previousValue === null) {
      return;
    }

    const inputValue = parseFloat(display);
    let newValue: number;

    switch (operation) {
      case '+':
        newValue = previousValue + inputValue;
        break;
      case '-':
        newValue = previousValue - inputValue;
        break;
      case '*':
        newValue = previousValue * inputValue;
        break;
      case '/':
        newValue = inputValue !== 0 ? previousValue / inputValue : 0;
        break;
      default:
        newValue = inputValue;
    }

    // Round to avoid floating point issues
    newValue = Math.round(newValue * 1000000) / 1000000;
    setDisplay(String(newValue));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }, [display, operation, previousValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      inputDigit(e.key);
    } else if (e.key === '.') {
      inputDecimal();
    } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
      performOperation(e.key);
    } else if (e.key === 'Enter' || e.key === '=') {
      calculate();
    } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      clear();
    }
  }, [inputDigit, inputDecimal, performOperation, calculate, clear]);

  return (
    <div
      className={styles.calculator}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Calculator"
    >
      <div
        className={styles.display}
        aria-live="polite"
        aria-atomic="true"
      >
        {display}
      </div>

      <div className={styles.buttons}>
        {/* Row 1 */}
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('7')}
          aria-label="7"
        >
          7
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('8')}
          aria-label="8"
        >
          8
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('9')}
          aria-label="9"
        >
          9
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.operator}`}
          onClick={() => performOperation('/')}
          aria-label="Divide"
        >
          /
        </button>

        {/* Row 2 */}
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('4')}
          aria-label="4"
        >
          4
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('5')}
          aria-label="5"
        >
          5
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('6')}
          aria-label="6"
        >
          6
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.operator}`}
          onClick={() => performOperation('*')}
          aria-label="Multiply"
        >
          *
        </button>

        {/* Row 3 */}
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('1')}
          aria-label="1"
        >
          1
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('2')}
          aria-label="2"
        >
          2
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('3')}
          aria-label="3"
        >
          3
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.operator}`}
          onClick={() => performOperation('-')}
          aria-label="Subtract"
        >
          -
        </button>

        {/* Row 4 */}
        <button
          type="button"
          className={`${styles.button} ${styles.clear}`}
          onClick={clear}
          aria-label="Clear"
        >
          C
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => inputDigit('0')}
          aria-label="0"
        >
          0
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={inputDecimal}
          aria-label="Decimal point"
        >
          .
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.operator}`}
          onClick={() => performOperation('+')}
          aria-label="Add"
        >
          +
        </button>

        {/* Equals row */}
        <button
          type="button"
          className={`${styles.button} ${styles.equals}`}
          onClick={calculate}
          aria-label="Equals"
        >
          =
        </button>
      </div>
    </div>
  );
}
