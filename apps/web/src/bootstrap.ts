// FILE: bootstrap.ts
// Purpose: Completes synchronous renderer storage migration before any app store can hydrate.

import "./processShim";
import "./storageOriginMigration";

void import("./main");
