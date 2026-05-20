import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Centralized setup for jest-dom matchers
expect.extend(matchers);