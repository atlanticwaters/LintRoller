const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Build plugin (sandbox code with Figma API access)
// Note: Figma's plugin sandbox uses an older JS engine that doesn't support
// optional chaining (?.) so we target es2017 to transpile it away
const pluginBuildOptions = {
  entryPoints: ['src/plugin/main.ts'],
  bundle: true,
  outfile: 'dist/plugin.js',
  target: 'es2017',
  format: 'iife',
  sourcemap: isWatch ? 'inline' : false,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"'
  },
  alias: {
    '@shared': './src/shared',
    '@plugin': './src/plugin'
  }
};

// Build UI (iframe code)
const uiBuildOptions = {
  entryPoints: ['src/ui/main.tsx'],
  bundle: true,
  outfile: 'dist/ui.js',
  target: 'es2020',
  format: 'iife',
  sourcemap: isWatch ? 'inline' : false,
  minify: !isWatch,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"'
  },
  alias: {
    '@shared': './src/shared',
    '@ui': './src/ui',
    'react': 'preact/compat',
    'react-dom': 'preact/compat'
  }
};

// Function to copy distribution files to _Figma Plugin/Lint Roller
function copyDistributionFiles() {
  const distDir = path.join('_Figma Plugin', 'Lint Roller');
  const distDistDir = path.join(distDir, 'dist');

  // Create directories if they don't exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  if (!fs.existsSync(distDistDir)) {
    fs.mkdirSync(distDistDir, { recursive: true });
  }

  // Copy manifest.json
  fs.copyFileSync('manifest.json', path.join(distDir, 'manifest.json'));
  console.log('Copied manifest.json');

  // Copy dist/plugin.js
  fs.copyFileSync('dist/plugin.js', path.join(distDistDir, 'plugin.js'));
  console.log('Copied dist/plugin.js');

  // Copy dist/ui.html
  fs.copyFileSync('dist/ui.html', path.join(distDistDir, 'ui.html'));
  console.log('Copied dist/ui.html');

  // Copy README.md
  if (fs.existsSync('README.md')) {
    fs.copyFileSync('README.md', path.join(distDir, 'README.md'));
    console.log('Copied README.md');
  }

  console.log(`Distribution files copied to "${distDir}"`);
}

// Function to build the UI HTML with inlined JS and CSS
function buildUIHtml() {
  const htmlTemplate = fs.readFileSync('src/ui/index.html', 'utf-8');

  let css = '';
  const cssPath = 'src/ui/styles/main.css';
  if (fs.existsSync(cssPath)) {
    css = fs.readFileSync(cssPath, 'utf-8');
  }

  let js = '';
  if (fs.existsSync('dist/ui.js')) {
    js = fs.readFileSync('dist/ui.js', 'utf-8');
  }

  const finalHtml = htmlTemplate
    .replace('<!-- INLINE_CSS -->', css ? `<style>${css}</style>` : '')
    .replace('<!-- INLINE_JS -->', js ? `<script>${js}</script>` : '');

  fs.writeFileSync('dist/ui.html', finalHtml);
  console.log('Built dist/ui.html');
}

async function build() {
  try {
    // Build plugin
    await esbuild.build(pluginBuildOptions);
    console.log('Built dist/plugin.js');

    // Build UI JS
    await esbuild.build(uiBuildOptions);
    console.log('Built dist/ui.js');

    // Build final UI HTML
    buildUIHtml();

    // Clean up intermediate ui.js file
    if (fs.existsSync('dist/ui.js')) {
      fs.unlinkSync('dist/ui.js');
    }

    // Copy distribution files to _Figma Plugin/Lint Roller
    copyDistributionFiles();

    console.log('Build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  // Plugin watcher
  const pluginContext = await esbuild.context(pluginBuildOptions);
  await pluginContext.watch();
  console.log('Watching plugin...');

  // UI watcher
  const uiContext = await esbuild.context({
    ...uiBuildOptions,
    plugins: [{
      name: 'rebuild-html',
      setup(build) {
        build.onEnd(() => {
          buildUIHtml();
        });
      }
    }]
  });
  await uiContext.watch();
  console.log('Watching UI...');

  // Also watch CSS and HTML
  const watchPaths = ['src/ui/styles/main.css', 'src/ui/index.html'];
  for (const watchPath of watchPaths) {
    if (fs.existsSync(watchPath)) {
      fs.watch(watchPath, () => {
        console.log(`${watchPath} changed, rebuilding HTML...`);
        buildUIHtml();
      });
    }
  }

  console.log('Watching for changes...');
}

if (isWatch) {
  watch();
} else {
  build();
}
