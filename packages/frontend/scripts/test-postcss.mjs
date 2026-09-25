import fs from 'fs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

const css = fs.readFileSync('./src/index.css', 'utf8');

postcss([tailwind(), autoprefixer])
  .process(css, { from: './src/index.css' })
  .then(result => {
    fs.writeFileSync('./tmp_postcss_output.css', result.css, 'utf8');
    console.log('Wrote processed CSS to ./tmp_postcss_output.css. Size:', result.css.length);
  }).catch(err => {
    console.error('PostCSS processing failed:', err.message);
    console.error(err.stack);
  });
