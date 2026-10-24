import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import { createConfig } from './tooling/eslint.mjs';

export default createConfig({ js, tseslint, vue, globals });
