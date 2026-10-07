# refund-policy-v2：公開文件來源／生成器盤點（apertis-ai/docs#39，D1，phase C）

- 父單：theQuert/stima-api#3629（D1–D14）。法律來源：theQuert/stima-api#3632（gate C4）。後端契約：theQuert/stima-api#3630。
- 基準：apertis-ai/docs `86847732528edaaf13281638f471ae33109f0550`（origin/main，2026-10-07）。
- Planning boundary：apertis-ai/docs#39 revision 2，digest `sha256:ea7219d984935c46e838a250b28a3a2f0b437eecf15ba72e9ab8c4034e7d4e6b`
  （以 theQuert/stima-api 的 `scripts/ci/planning_boundary.py digest` 對 2026-10-07 取得的 issue body 計算，唯讀使用）。
- 本檔是內部稽核紀錄，不在 Docusaurus／Nimbus 的任何輸入根目錄下（`docs/`、`docs-api/`、`src/pages/`、`blog/`、`static/`、
  `site-nimbus/`），`scripts/index-docs.ts` 只掃 `docs/**/*.md` 與 `docs-api/**/*.md`，所以本檔不會被建置、發布或索引。

## 1. 建置鏈路（實際讀過的檔案）

| 階段 | 檔案 | 作用 |
|---|---|---|
| 正式 build | `package.json` `build` → `scripts/nimbus/pages-build.sh` | Cloudflare Pages 專案 `docs` 每次 push 都跑；發布 `build/`（= `site-nimbus/dist` 複本）與 `functions/`。舊 Docusaurus 只剩 `npm run build:legacy`，不再服務。 |
| 守門 | `scripts/nimbus/check-build-id.mjs` | 已提交的 manifest 必須是本 checkout 的（`sourceSha` + build inputs hash）；內容改了沒 regenerate 就 build 失敗，Pages 繼續服務前一版。 |
| Phase 1 生成器 | `site-nimbus/converter/convert.ts`（`npm run m2:regenerate` 的前半） | 讀 `migration/nimbus/route-inventory.json` 每個 preserve 列，將 legacy 原始檔轉成 render source、clean Markdown、`manifest.json`、`page-meta.json`。輸出目錄每次先清空。 |
| Phase 2 | `site-nimbus/converter/integration.ts`（astro build 內） | 複製 `src/content/public/**` 到 `dist/`、寫 `sitemap.xml`、`_redirects`、`llms.txt`、`llms-full.txt`（`src/agent/llms.ts`），補 manifest hash。 |
| 站內搜尋 | `site-nimbus/src/search/index-build.ts`（Pagefind 1.5.2） | build 時爬 `dist/` 全部 HTML 產生 `dist/pagefind/`。 |
| Agent 存取 | `functions/mcp.ts` → `site-nimbus/src/agent/mcp.ts` | `/mcp` 讀同一部署的 `/llms.txt` 與 `/llms-full.txt`，不另存內容。 |
| Ask Docs RAG（舊） | `.github/workflows/index-docs.yml` → `scripts/index-docs.ts` | push 到 `main` 且動到 `docs/**` 或 `docs-api/**` 時，把**原始檔**寫入 Supabase。merge 後自動更新，不等 Pages。 |
| Ask Docs RAG（generation） | `indexer/`、`supabase/migrations/20260929000000_docs_generations.sql` | 依 manifest 建 generation；啟用（`docs_generation_activate`）只限 operator，不是 merge 自動發生。 |

**唯一 canonical source**：`docs/billing/payg.md`、`docs/billing/payment-methods.md`、`docs/billing/subscription-plans.md`、
`docs/help/faq.md`。`site-nimbus/README.md`「#13 Authoring-source ownership」明定 legacy 原始檔是唯一撰寫來源，
`site-nimbus/src/content/**` 與 `src/manifest/manifest.json` 全是生成物，`test/m2-convert.test.ts` 對任何手改都會失敗。

## 2. Locale

只有英文。證據：`docusaurus.config.js` `i18n.locales: ["en"]`；`site-nimbus/astro.config.ts` `locale: 'en'`；
`migration/nimbus/route-inventory.json` 沒有任何 `/ja` 路徑；repo 內沒有 `i18n/` 目錄。docs 沒有 JA 表面，不宣稱涵蓋 JA；
JA 屬於 app（theQuert/stima-api#3632）。

## 3. 載體清單與分母

每頁的公開表示（「載體」）：

| # | 載體 | payg | payment-methods | subscription-plans | help/faq |
|---|---|---|---|---|---|
| 1 | canonical source | `docs/billing/payg.md` | `docs/billing/payment-methods.md` | `docs/billing/subscription-plans.md` | `docs/help/faq.md` |
| 2 | render source（生成） | `site-nimbus/src/content/docs/billing/payg/index.md` | `…/billing/payment-methods/index.md` | `…/billing/subscription-plans/index.md` | `…/help/faq/index.md` |
| 3 | clean Markdown（生成，原樣複製到 dist） | `site-nimbus/src/content/public/billing/payg.md` | `…/public/billing/payment-methods.md` | `…/public/billing/subscription-plans.md` | `…/public/help/faq.md` |
| 4 | HTML（build） | `/billing/payg/` | `/billing/payment-methods/` | `/billing/subscription-plans/` | `/help/faq/` |
| 5 | served `.md`（build） | `/billing/payg.md` | `/billing/payment-methods.md` | `/billing/subscription-plans.md` | `/help/faq.md` |
| 6 | Pagefind 索引（build） | ✓ | ✓ | ✓ | ✓ |
| 7 | `llms-full.txt`（build，全文；`/mcp` 讀它） | ✓ | ✓ | ✓ | ✓ |
| 8 | Ask Docs 舊 RAG（Supabase，merge 後由 workflow 從 #1 重建） | ✓ | ✓ | ✓ | ✓ |

分母：4 頁 × 8 載體 = **32**。另外：

- `llms.txt` 每頁只有標題與一行描述，四頁描述都不含退款字樣，不算政策載體。`sitemap.xml` 只有 URL。
- `manifest.json`（`contentSha256`）與 `page-meta.json`（更新日期、閱讀時間）是生成的中繼資料，不含政策文字，但內容一改就必須跟著 regenerate（見 §6）。
- Ask Docs generation 索引（#8 的新制）只有 operator 啟用後才服務；本輪不碰。
- 側邊載體：`site-nimbus/src/components/shell/Footer.astro:17` 的「Refund Policy」連到 `https://apertis.ai/refund`（app 法律頁的 current 路徑，不帶版本）；
  只是一條連結，文字不需改。

不是退款政策載體（已查、不改）：`docs-api/utilities/billing-credits.md:152`（API 欄位 `cancelled` 狀態列舉）；
`assistant/`、`indexer/`、`functions/` 內的 `cancel` 都是串流／程序取消；`migration/nimbus/route-fixtures.json` 與
`route-inventory.json` 只存 heading id。

## 4. 現行（current）退款／取消承諾，逐行

| 位置 | 現行文字 | 問題（對照 D1–D14） |
|---|---|---|
| `docs/billing/payg.md:308-320` | 「Unused balance is generally non-refundable」「Contact support for exceptional circumstances」「Allow 5-7 business days for review」 | 例外沒列出；5–7 工作天審核與 app 的 3 工作天不一致（D14）。 |
| `docs/billing/payment-methods.md:188-199` | 退款申請步驟；「Processing time: 5-10 business days」 | 與 app 不同的處理時程；沒有提醒不要寄完整卡號／CVC（D14）。 |
| `docs/billing/payment-methods.md:125-129` | 關閉 Auto Top-Up 的步驟 | 沒說明關閉只停未來扣款、不是取消訂閱也不是退款（D4）。 |
| `docs/billing/subscription-plans.md:165-176` | 取消時可選「**Immediate**: Ends now (no refund for remaining period)」或 End of Period | **宣稱不存在的自助能力**：使用者端 `POST /api/subscription/cancel` 只做 `cancel_at_period_end`（stima-api `controller/subscription.go` `CancelSubscription`），即時取消只在 admin（`controller/admin_subscription.go`、`subscription_admin_refund.go`）。 |
| `docs/billing/subscription-plans.md:276-278` | 「Refunds are handled on a case-by-case basis」 | 籠統，沒有政策與例外。 |
| `docs/help/faq.md:118-120` | 「Refunds are handled case-by-case」 | 同上。 |

docs 目前**沒有**三天退款窗口、24 小時誤購、或 2×／3× 中斷延長的字樣：issue 背景「不能誤稱所有 docs 都承諾三天」已證實。
這些承諾只在 app 法律頁。

App 現行法律頁（僅供對照）：讀自本機 `~/GitHub/stima-api` primary checkout 的工作樹
`web/next/lib/legal/content/refund/2026-03-10.en.ts`，該 checkout 的 revision 未驗證（本 session 不能 fetch 或讀 stima-api 的 git），
不能當作 origin/main 的事實。內容：首購訂閱 3 日曆天按配額比例退、one-time 未用 3 天全退、24 小時內誤購、
3 工作天審核、7–14 工作天到帳、24–48h 中斷 2×／>48h 3× 延長、TW 7 天／EU 14 天法定權利。registry 為 `/refund`，
舊版在 `/refund/<effective>`（`web/next/lib/legal/registry.ts`）。

## 5. current 與 archive 的分界

- **current（本案要改）**：§4 的四個 canonical source 段落，以及它們生成的 #2–#8 載體。
- **archive（不改）**：
  - `site-nimbus/src/components/catalog/changelog.json` 2026-04-24「Subscription Quota Multiplier Update」公告裡的「you may cancel your subscription at any time before 2026-04-24」：已過期的歷史公告。
  - `migration/nimbus/baseline/live-snapshot.json` 與 `route-inventory.json` 的 `live` 欄位：cutover 前的凍結快照。
  - app 的 superseded 法律版本（stima-api，非本 repo）。
- 一致性檢查只掃 current 載體，不以全 repo 字串搜尋清空歷史。

## 6. 發布、索引與回退

- **merge 到 `main` = 公開發布**：Pages 對 `main` 的 push 跑 `pages-build.sh` 並上線；同一 push 也觸發 `index-docs.yml` 重寫 Supabase 舊 RAG。
- **branch push 可能產生預覽**：Pages 預設會為非 production branch 建 preview deployment（repo 內沒有設定可證明關閉）。
  `nimbus-pr-gates.yml` 也在 `pull_request` 與 `claude/nimbus-**` push 上跑。所以 **lead push 本 branch 就可能讓候選文字出現在預覽網址**；
  production 與 RAG 只在 merge 後變。
- **建置閘門**（候選文案必須遵守）：
  - `site-nimbus/test/dist.check.ts:189-197`：inventory 記錄的 heading id 必須仍在頁上：`refunds`、`refund-policy`、`requesting-a-refund`、
    `refund-requests`、`cancelling-subscription`、`can-i-get-a-refund`，四頁原有標題全保留，只改內文；新增 H3 可以。
  - `dist.check.ts` 的連結比對：頁面連結必須等於凍結 legacy 連結集，**增刪任何連結都要記在 `migration/nimbus/content-changes.json`**。
  - `sourceSha` 拒絕未提交的 legacy 變更：先 commit `docs/`，再 regenerate。
  - regenerate 一定改 `site-nimbus/src/manifest/manifest.json` 與 `site-nimbus/src/content/docs/page-meta.json`（前例：1f8bfae）。
- **回退**：build 失敗時 Pages 繼續服務前一版；已上線的錯誤靠 revert commit（或 Pages 回到前一個 deployment，operator 操作）再 build，
  並重跑 `index-docs.yml` 讓 RAG 回到舊文字。回退不得在 app 已適用新條款時讓 docs 回到三天承諾以外的另一套說法（parent rollout）。

## 7. Write-set 缺口（PLANNER_ESCALATION 草稿，交 lead）

planning boundary rev 2 的 write_set 少了以下現有閘門必經的路徑：

1. `site-nimbus/src/manifest/manifest.json` 與 `site-nimbus/src/content/docs/page-meta.json`：任何 regenerate 都會改；
   不提交就是 `check-build-id`、`CI=1 npm run build` 與 `test/m2-convert.test.ts` 失敗。how 9 要求「用 existing generator 更新 mirrors」，兩者不可分。
2. `migration/nimbus/content-changes.json`：最終文案要「連完整條款」（how 3、how 8）；新增任何連結都要在這裡登記，否則 `test:dist` 失敗。
   候選文案先不加連結，所以 phase C 不需要它；C4 之後的最終版需要。
3. `openspec/changes/<change>/`：通用規則要求 strict OpenSpec 先於程式；本 repo 的文件內容變更有用 OpenSpec 的前例
   （`openspec/changes/developer-activation-docs/`）。write_set 沒有 `openspec/`。

不影響的部分：canonical source 編輯、本稽核檔、一致性檢查腳本都在 write_set 內。

## 8. 候選文案規格（phase C，未發布）

每條對應 issue how 編號；最終文字等 theQuert/stima-api#3632 的 reviewed source。

- R1（how 1）：PAYG 手動與 Auto Top-Up、訂閱首購／續訂／升級、PAYG fallback 等額外用量原則上不退款，未使用也一樣；
  沒有通用退款窗口；誤購、後悔、忘記取消、一般不滿意本身不構成資格。
- R2（how 2）：列出例外：適用法律、書面契約、交易當時適用的舊版政策、核實的重複／錯誤／未授權扣款、核實的重大 Apertis 服務或存取故障、
  非使用者違約而由 Apertis 終止的未交付預付服務。申請不等於核准。
- R3（how 3）：地區權利摘要只到 D3 的層級（EEA/UK 14 天、Turkey 相應規則、KR 7 天未用與其後按剩餘期間比例、TW 與其他法域較高權利），
  註明依產品、消費者／企業身分與準據法判斷，不只看 IP 或卡片國家；不確定也可申請。確切文字掛 TODO 等 C4。
- R4（how 4）：一般取消停下一期續訂，用到已付期間結束；刪除不存在的「Immediate」自助選項；Auto Top-Up 是獨立設定，關閉只停未來扣款；取消不是退款。
- R5（how 5）：現金退款回原付款方式；促銷／贈送額度不兌現；API 請求的餘額自動調整不是退款，也不受影響。
- R6（how 6）：申請寄 hi@apertis.ai；附帳號 email、交易日期與金額、主張的例外；不要寄完整卡號或 CVC；
  3 工作天內初步回應的目標；以收到時間為準，不延長或縮短法定期限；到帳時間依付款方式，不承諾天數。
- R7（how 7）：服務事故依核實事故、法律、書面 SLA 或契約補救，沒有固定的延長倍率；舊交易與既有事故承諾保留。
- R8（how 8）：只適用新版公開後的購買；自動續訂與 Auto Top-Up 需依通知期後才適用；舊購買保留原條款。版本、hash、生效日、法律頁連結全掛 TODO。
- R9（how 9）：只改 canonical source，mirrors 用 `m2:regenerate`；`scripts/nimbus/refund-policy-check.mjs` 檢查 current 載體一致、舊字串消失、TODO 標記不存在。
- R10（how 10）：不動 PAYG「Balance never expires」、$5 minimum、價格、配額、volume discount、PAYG fallback、升級經濟、付款通路、3–7 天 grace period。

## 9. 相鄰的範圍外發現（記一次，不改）

- `docs/billing/subscription-plans.md:156-159`「Upgrading: Quota is prorated for the remaining period」與 app 法律頁
  「previous plan's remaining time and unused monthly quota are forfeited … billing cycle resets」相反。屬升級經濟描述（D9 不改），交 owner。
- `site-nimbus/README.md:462`「No `llms*` file is produced at all」已過時：phase 2 現在寫 `llms.txt`／`llms-full.txt`（`converter/integration.ts:139`）。
- 一致性檢查沒有接進 `pages-build.sh` 或 `nimbus-pr-gates.yml`（兩者都不在 write_set）：TODO 標記本身不會讓正式 build 失敗，
  防止誤發布目前只靠「不 push、不 merge」與人工跑檢查。

## 10. Phase C 驗證紀錄（本機，未 push，非 serving 證據）

- 候選文案：canonical source 在 `f9e1c68`、`ace8984`（D12 適用條件修正）；`scripts/nimbus/refund-policy-check.mjs` 同兩個 commit
  （`scripts/` 被根 `.gitignore` 忽略，既有腳本同樣以 `git add -f` 追蹤）。四頁 mirrors 在 `dc0363f`、`03ed4e0`。
- 生成：`npm run m2:regenerate` 只改四頁的 render source／clean Markdown 與 `manifest.json`、`page-meta.json`。
  在 `03ed4e0` 上連跑兩次，未提交的兩檔 diff 完全相同（`git diff -- site-nimbus/src/manifest/manifest.json site-nimbus/src/content/docs/page-meta.json | shasum -a 256`
  = `b9998c95…8b8d`，`sourceSha` = `ace8984e…`），冪等。兩檔依 §7 未提交；**已提交的 head 本身過不了 `check-build-id`／m2-convert**，
  以下 PASS 都是「head + 這兩個生成檔」的工作樹狀態。rebase 到有新 legacy-root commit 的 main 會讓 `sourceSha`、`updated` 失效，需重跑 regenerate。
- 照 `nimbus-pr-gates.yml`：candidate job 的 `check-build-id.mjs`（buildId `ace8984e….1bc5f368f35e`）、`CI=1 npm run build`（未改任何 tracked file）、
  `typecheck` 0 errors、`npm test` 223 項 157 pass／0 fail／66 skip（需 `PREVIEW_URL` 的瀏覽器測試，CI 的 candidate job 同樣 skip）、
  `test:dist` 30／30（含 heading id 與連結比對）、`check-developer-activation.mjs` 全過；root job 的 `npm ci` + `npm run build:legacy` 通過（本機 Node 25，CI 用 22）。
  **NOT RUN**：preview job（`test:routes`、`route-fixtures.mjs`、`test:m3-browser`、`m4-e2e`）與 Ask Docs／indexer job；沒有任何 serving／preview 讀回。
- `refund-policy-check.mjs`：24 個 current 載體（4 頁 × source、render、clean、HTML、served `.md`、`llms-full.txt`），唯一失敗是 24 個 `TODO(refund-policy-v2)` 標記，符合預期。
  去掉標記的副本 → `ok`；在副本放回「case-by-case」「3 days」、改掉「Balance never expires」、改動 archive 公告 → 各自被抓到；基準 `8684773` 內容 → 抓到 5-7／5-10 工作天、case-by-case、Immediate 取消。
  必要語句是 phase C 候選文字，C4 後要換成 reviewed legal source 的文字；它們不是政策權威。檢查**沒有接進任何 build 或 CI**。
- 依據的 app 事實（讀自本機 stima-api primary checkout 工作樹，revision 未驗證）：使用者取消只排 `cancel_at_period_end`、不動 Auto Top-Up
  （`controller/subscription.go` `CancelSubscription`）；設定頁顯示結束日（`web/default/src/components/settings/PlanCard.jsx:258` 「Will end on」）。

## 11. C4 對齊（legal source：theQuert/stima-api#3632 @ `ae6a66c3ac6c9ad57a513eb50060581f6fc8e224`，draft PR #3650）

- 來源取得：本 session 對 stima-api 的 `git show` 被權限擋下，改讀 `stima-api-worktrees/claude-3632-refund-legal-surfaces` 工作樹檔案。
  綁定方式：worktree 的 `HEAD` ref 檔指向 `ae6a66c3a…`；EN source 檔 sha256 `0dcc668c…6350` 與 fixture sha256 `76c746f6…c30d`
  都等於交接檔記載的值，所以讀到的位元組就是 review 過的內容（EN markdown `6c436066…3bfd` 是交接檔記載值，本 repo 沒有重算 `buildLegalMarkdown`）。
- 四頁的退款、取消、自動 top-up、中斷、付款、申請用語改為逐字引用候選版 §1–§5、§7、§9、§10（交接檔「適用範圍用語」）。
  docs 只加了節標題、「(Section n)」對照，以及連到 `https://apertis.ai/refund`（不帶日期）。連結暫以 code 文字呈現，
  因為變成真正的超連結需要在 `migration/nimbus/content-changes.json` 登記（revision 3 escalation）。
- 舊 `TODO(refund-policy-v2)` 全部移除，每頁改留一個 `TODO(refund-policy-v2-date)`：公告、通知、生效日未定，頁面不寫日期，也不寫已生效。
- `refund-policy-check.mjs` 釘住來源 head 與三個 hash；`--legal-fixture <fixture>` 會驗 fixture hash，並確認 docs 引用的每一句都是 fixture 的原文。
- 驗證（docs commit `091e759`、mirrors `b558ed6`；未提交的 manifest／page-meta diff sha256 `85d7ebe0…ff3d`，`sourceSha` `091e7598…`，連跑兩次相同）：
  check-build-id、`CI=1` build（未改 tracked file）、typecheck 0 errors、`npm test` 157 pass／0 fail／66 skip、`test:dist` 30／30、
  developer-activation、`build:legacy` 都通過；refund-policy-check 24 個載體只剩 24 個日期 TODO 失敗。
  拿掉日期標記的副本回 `ok`；在副本放進帶日期的連結或「14-day right」、改動地區句 → 都被抓到；改動 fixture 一個字 → hash 不符，且被改的那句報「不是 fixture 原文」。

## 12. Revision 3（digest `sha256:9839d7cc498fbfb29233b2ead3405c2de12b9860ca16445baae32056d630b456`）

- OpenSpec：`openspec/changes/refund-policy-v2-docs/`（capability `public-refund-docs`），`openspec validate refund-policy-v2-docs --strict` 通過；spec 先於本輪內容變更 commit（`2c57260`）。
- 法律頁連結改成真正的超連結 `https://apertis.ai/refund`（`fa69371`），四頁都在 `migration/nimbus/content-changes.json` 登記（`3ee809a`）。
  FAQ 原有的條目（55608c9 的 Playground 變更）因為 schema 一份文件只有一個 commit 欄位，改記最新的 `fa69371`，舊 commit 寫在 decision 裡保留。
- `scripts/nimbus/pages-build.sh` 在 `test:dist` 之後、產生 `build/` 之前跑 `refund-policy-check.mjs`。
- 生成檔全部提交（`327c297`，`sourceSha` `fa69371…`）：已提交的 head 上 `m2:regenerate` 不改任何 tracked file，`check-build-id` 通過。
- 驗證（head `327c297`，工作樹乾淨）：`CI=1` build 通過且未改 tracked file、typecheck 0 errors、`npm test` 157 pass／0 fail／66 skip、`test:dist` 30／30、
  developer-activation、`build:legacy` 通過；refund-policy-check（加 `--legal-fixture`）24 個載體只剩 24 個日期 TODO 失敗。
- fail-closed 證明：本 head 跑 `bash scripts/nimbus/pages-build.sh` → exit 1，24 個失敗全是日期 TODO，沒有產生 `build/`；
  在本 repo 的本機 clone 拿掉四個日期標記、commit、regenerate 後跑同一支 → exit 0，check `ok`，產生 `build/`。
