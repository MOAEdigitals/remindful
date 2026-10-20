import {build} from 'esbuild';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd()},tsconfigRaw:{},absWorkingDir:process.cwd(),bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'linked',outfile:'dist/vendor/supabase.js'});
