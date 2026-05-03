/**
 * Outputs docs/auth-flow.excalidraw (Excalidraw JSON).
 * Run: node scripts/generate-auth-flow-excalidraw.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "docs", "auth-flow.excalidraw");

const W = 360;
const X = 280;
let n = 0;
const ids = () => `a${(++n).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function rect(label, top, opts = {}) {
  const { w = W, h = 56, fill = "#e7f5ff", stroke = "#1971c2" } = opts;
  const rid = ids();
  const tid = ids();
  const x = X;
  const els = [
    {
      type: "rectangle",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1e9),
      isDeleted: false,
      id: rid,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      x,
      y: top,
      strokeColor: stroke,
      backgroundColor: fill,
      width: w,
      height: h,
      seed: Math.floor(Math.random() * 1e5),
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      boundElements: [{ type: "text", id: tid }],
      updated: 1,
      link: null,
      locked: false,
    },
    {
      type: "text",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1e9),
      isDeleted: false,
      id: tid,
      x: x + 12,
      y: top + 18,
      width: w - 24,
      height: h - 36,
      text: label,
      fontSize: 14,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: rid,
      originalText: label,
      lineHeight: 1.25,
      baseline: 17,
    },
  ];
  return { els, top, bottom: top + h, cx: x + w / 2, cy: top + h / 2 };
}

function diamond(label, top, opts = {}) {
  const { w = 260, h = 110, fill = "#fff3bf", stroke = "#e67700" } = opts;
  const rid = ids();
  const tid = ids();
  const x = X + (W - w) / 2;
  const els = [
    {
      type: "diamond",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1e9),
      isDeleted: false,
      id: rid,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      x,
      y: top,
      strokeColor: stroke,
      backgroundColor: fill,
      width: w,
      height: h,
      seed: Math.floor(Math.random() * 1e5),
      groupIds: [],
      frameId: null,
      boundElements: [{ type: "text", id: tid }],
      updated: 1,
      link: null,
      locked: false,
    },
    {
      type: "text",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1e9),
      isDeleted: false,
      id: tid,
      x: x + 14,
      y: top + 42,
      width: w - 28,
      height: h - 84,
      text: label,
      fontSize: 12,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: rid,
      originalText: label,
      lineHeight: 1.2,
      baseline: 14,
    },
  ];
  return { els, top, bottom: top + h, cx: x + w / 2, cy: top + h / 2 };
}

function arrow(x1, y1, x2, y2) {
  const id = ids();
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    type: "arrow",
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    id,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    angle: 0,
    x: x1,
    y: y1,
    strokeColor: "#495057",
    backgroundColor: "transparent",
    width: Math.max(Math.abs(dx), 1),
    height: Math.max(Math.abs(dy), 1),
    seed: 1,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    points: [
      [0, 0],
      [dx, dy],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    updated: 1,
    link: null,
    locked: false,
  };
}

function lbl(x, y, text) {
  return {
    type: "text",
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    id: ids(),
    x,
    y,
    width: 160,
    height: 20,
    text,
    fontSize: 11,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "middle",
    containerId: null,
    originalText: text,
    lineHeight: 1.2,
    baseline: 13,
  };
}

const g = 24;
let y = 48;

const title = {
  type: "text",
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  id: ids(),
  x: X,
  y: 12,
  width: 720,
  height: 32,
  text: "AgencyOS — Authentication flow (NextAuth + lib/auth.ts)",
  fontSize: 22,
  fontFamily: 1,
  textAlign: "left",
  verticalAlign: "middle",
  containerId: null,
  originalText: "AgencyOS — Authentication flow (NextAuth + lib/auth.ts)",
  lineHeight: 1.2,
  baseline: 20,
};

const elements = [title];

function pushArrow(a, b) {
  elements.push(arrow(a.cx, a.bottom, b.cx, b.top));
}
function pushArrowLabeled(a, b, label, lx, ly) {
  elements.push(arrow(a.cx, a.bottom, b.cx, b.top));
  if (label) elements.push(lbl(lx, ly, label));
}

const nLogin = rect("User at /login (app/login/page.tsx)", y);
y = nLogin.bottom + g;
const nSubmit = rect("Submit → signIn('credentials', { redirect: false })", y);
y = nSubmit.bottom + g;
const nApi = rect("NextAuth API: app/api/auth/[...nextauth]/route.ts", y);
y = nApi.bottom + g;
const dCred = diamond("authorize(): credentials present?", y);
y = dCred.bottom + g;
const nFail = rect("Return null → sign-in error", y, { fill: "#ffe3e3", stroke: "#c92a2a" });
y = nFail.bottom + g;
const nAgencyLookup = rect("Query users by email (agency)", y);
y = nAgencyLookup.bottom + g;
const dAgency = diamond("Agency user row found?", y);
y = dAgency.bottom + g;
const nAgencyPw = rect("bcrypt.compare(password, users.passwordHash)", y);
y = nAgencyPw.bottom + g;
const nAgencyOk = rect("Return agency user + role", y, { fill: "#d3f9d8" });
y = nAgencyOk.bottom + g;
const nClientLookup = rect("Query client_users by email", y);
y = nClientLookup.bottom + g;
const dClient = diamond("Active + passwordHash?", y);
y = dClient.bottom + g;
const nClientPw = rect("bcrypt + load client (portalEnabled, not deleted)", y);
y = nClientPw.bottom + g;
const nClientOk = rect("lastLoginAt update → return client_portal + clientId", y, { fill: "#d3f9d8" });
y = nClientOk.bottom + g;
const nJwt = rect("jwt + session callbacks → cookie session", y, { fill: "#e5dbff" });
y = nJwt.bottom + g;
const dClientResult = diamond("signIn result (client)?", y);
y = dClientResult.bottom + g;
const nErrUi = rect("Show invalid credentials on /login", y, { fill: "#ffe3e3", stroke: "#c92a2a" });
y = nErrUi.bottom + g;
const nDashNav = rect("router.push(/dashboard) + router.refresh()", y);
y = nDashNav.bottom + g;
const dLayout = diamond("getServerSession in dashboard/layout.tsx", y);
y = dLayout.bottom + g;
const nNoSess = rect("redirect /login?callbackUrl=/dashboard", y, { fill: "#ffec99" });
y = nNoSess.bottom + g;
const nPortal = rect("role client_portal → redirect /portal", y, { fill: "#ffec99" });
y = nPortal.bottom + g;
const nStaff = rect("Agency/member → dashboard shell", y, { fill: "#d3f9d8" });
y = nStaff.bottom + g;
const nPortalNote = rect("Portal: proxy.ts (JWT) + getPortalSession()", y, { fill: "#e7f5ff" });

for (const n of [
  nLogin,
  nSubmit,
  nApi,
  dCred,
  nFail,
  nAgencyLookup,
  dAgency,
  nAgencyPw,
  nAgencyOk,
  nClientLookup,
  dClient,
  nClientPw,
  nClientOk,
  nJwt,
  dClientResult,
  nErrUi,
  nDashNav,
  dLayout,
  nNoSess,
  nPortal,
  nStaff,
  nPortalNote,
]) {
  elements.push(...n.els);
}

pushArrow(nLogin, nSubmit);
pushArrow(nSubmit, nApi);
pushArrow(nApi, dCred);
// dCred -> fail (left branch)
elements.push(arrow(dCred.cx - 120, dCred.cy, nFail.cx - 140, nFail.cy));
elements.push(lbl(dCred.cx - 280, dCred.cy - 10, "No / missing"));
// dCred -> agency lookup (main)
pushArrowLabeled(dCred, nAgencyLookup, "Yes", dCred.cx + 8, dCred.bottom - 4);

pushArrow(nAgencyLookup, dAgency);
pushArrow(dAgency, nAgencyPw);
elements.push(lbl(dAgency.cx + 8, (dAgency.bottom + nAgencyPw.top) / 2, "Yes"));
pushArrow(nAgencyPw, nAgencyOk);
elements.push(lbl(nAgencyPw.cx + 8, (nAgencyPw.bottom + nAgencyOk.top) / 2, "valid"));

// dAgency No -> client lookup
elements.push(arrow(dAgency.cx - 130, dAgency.cy, nClientLookup.cx - 160, nClientLookup.cy));
elements.push(lbl(dAgency.cx - 300, dAgency.cy - 10, "No → client path"));

pushArrow(nClientLookup, dClient);
pushArrow(dClient, nClientPw);
elements.push(lbl(dClient.cx + 8, (dClient.bottom + nClientPw.top) / 2, "Yes"));
pushArrow(nClientPw, nClientOk);
elements.push(lbl(nClientPw.cx + 8, (nClientPw.bottom + nClientOk.top) / 2, "valid"));

// Agency success merges to jwt: from nAgencyOk and nClientOk both to nJwt — draw from agency ok; client ok horizontal to merge
elements.push(arrow(nAgencyOk.cx, nAgencyOk.bottom, nJwt.cx, nJwt.top));
elements.push(
  arrow(nClientOk.cx - 40, nClientOk.bottom + 10, nJwt.cx + 40, nJwt.top + 20),
  lbl(nClientOk.cx - 20, nClientOk.bottom + 2, "merge")
);

pushArrow(nJwt, dClientResult);
// error vs ok from dClientResult
elements.push(arrow(dClientResult.cx - 100, dClientResult.cy, nErrUi.cx - 40, nErrUi.cy));
elements.push(lbl(dClientResult.cx - 220, dClientResult.cy - 22, "error"));
elements.push(arrow(dClientResult.cx + 80, dClientResult.cy, nDashNav.cx + 40, nDashNav.cy));
elements.push(lbl(dClientResult.cx + 90, dClientResult.cy - 22, "ok"));

pushArrow(nDashNav, dLayout);
elements.push(arrow(dLayout.cx - 90, dLayout.bottom + 5, nNoSess.cx - 50, nNoSess.top + 10));
elements.push(lbl(dLayout.cx - 240, dLayout.bottom + 2, "no session"));
elements.push(arrow(dLayout.cx, dLayout.bottom, nPortal.cx, nPortal.top));
elements.push(lbl(dLayout.cx + 8, dLayout.bottom + 6, "client_portal"));
elements.push(arrow(dLayout.cx + 90, dLayout.bottom + 5, nStaff.cx + 50, nStaff.top + 10));
elements.push(lbl(dLayout.cx + 100, dLayout.bottom + 2, "staff"));

pushArrow(nPortal, nPortalNote);

const foot = {
  type: "text",
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  id: ids(),
  x: X - 40,
  y: nPortalNote.bottom + 16,
  width: W + 120,
  height: 72,
  text:
    "Any failed check in authorize() returns null (same outcome as first red box).\\nproxy.ts also guards /portal and member dashboard paths (see proxy.ts).",
  fontSize: 12,
  fontFamily: 1,
  textAlign: "left",
  verticalAlign: "top",
  containerId: null,
  originalText: "",
  lineHeight: 1.35,
  baseline: 14,
};
foot.originalText = foot.text.replace(/\\\\n/g, "\n");
foot.text = foot.originalText;

elements.push(foot);

const payload = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements,
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null,
  },
  files: {},
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
console.log("Wrote", out);
