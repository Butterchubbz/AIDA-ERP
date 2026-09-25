import fs from 'fs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

const cssInput = `@tailwind base;\n@tailwind components;\n@tailwind utilities;`;

postcss([tailwind(), autoprefixer])
  .process(cssInput, { from: undefined })
  .then(result => {
    const outPath = './public/tailwind-test.css';
    fs.mkdirSync('./public', { recursive: true });
    fs.writeFileSync(outPath, result.css, 'utf8');
    console.log('Wrote', outPath);
  }).catch(err => {
    console.error('Failed to build tailwind:', err.message);
    console.error(err.stack);
  });
