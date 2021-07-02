'use strict';

if (require.main === module) throw new Error("No. Can't run this as a module");

// Enable source map support for errors
import 'source-map-support/register';

// Our "mains"
import './Monitor/main';
