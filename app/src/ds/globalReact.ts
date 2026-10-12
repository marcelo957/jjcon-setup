import React from 'react';

// The Bushido v2 bundle is a classic script that reads a global `React`. This module must be
// imported before the bundle so the global exists when it evaluates.
(window as unknown as { React: typeof React }).React = React;
