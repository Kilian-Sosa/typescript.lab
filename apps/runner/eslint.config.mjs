import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { createConfig } from '../../tooling/eslint.mjs';

export default createConfig({ js, tseslint, globals });
