# ToDo アプリ仕様書

## 要件定義

### 機能要件
- **タスク入力フォーム**（画面上部）
  - フィールド: 種類（仕事 / 家 / スキルアップ）, タスク名, 締切日, 重要度 (1–5), 工数 (時間)
  - キーボード操作の Tab 移動で高速入力
- **タスク一覧ボード**（画面下部）
  - 三列構成（左から仕事・家・スキルアップ）
  - 緊急性 `=(工数 × 重要度) ÷ (残り日数^1.5)` の降順で自動ソート
  - 緊急性のスコアに応じた背景色グラデーション（高: 赤系 → 低: 青系）
  - タスクをクリックすると完了になり一覧から消去
  - メインタスクにサブタスクを任意個ぶら下げ可能（折り畳み可）
- **履歴管理**
  - 完了時にタスク情報・完了日時・工数を履歴へ保存
  - 画面下部の「履歴バー」から履歴ビューへ遷移
  - 履歴ビューでは期間フィルタと累計工数を表示
- **PWA 対応**
  - オフライン起動・ホーム画面追加をサポート
  - 1 秒以内の初期表示と 100 ms 以内の操作反応を目標

### 非機能要件
- 完全ローカル動作（外部通信なし）
- レスポンシブ設計（PC・タブレット・モバイル）
- 色弱者対応パレットと数値ツールチップ
- ソースコード Linter と自動テストによる品質担保

### UI / UX 指針
1. **レイアウト**  
   - 上段: 入力フォーム（1 行）  
   - 下段: 三分割タスクボード  
2. **操作性**  
   - クリックでタスク完了  
   - サブタスクは親直下インデント表示  
3. **アクセシビリティ**  
   - キーボード操作完備  
   - コントラスト比 4.5:1 以上  

---

## DB 設計（IndexedDB + Dexie.js）

| ストア | カラム | 説明 |
|-------|--------|------|
| **tasks** | `id` (PK, Auto) | 自動生成 ID |
|  | `type` (string) | "work" / "home" / "skill" |
|  | `name` (string) | タスク名 |
|  | `due_date` (string ISO) | 締切日 |
|  | `importance` (int) | 1–5 |
|  | `effort_hours` (float) | 工数 h |
|  | `parent_id` (int / null) | 親タスク ID |
|  | `status` ("active" / "done") | 状態 |
|  | `created_at` (string ISO) | 作成日時 |
| **history** | `id` (PK, Auto) | 自動生成 ID |
|  | `task_id` (int) | tasks.id 参照 |
|  | `completed_at` (string ISO) | 完了日時 |
|  | `effort_hours` (float) | 実績工数 |

**インデックス**
- `tasks`: `status + due_date` 複合インデックス
- `history`: `completed_at` インデックス

---

## 利用技術スタック

| レイヤ | 採用技術 | 目的 / 利点 |
|-------|---------|------------|
| UI フレームワーク | **Svelte (JavaScript)** | コンパイル時最適化で軽量。学習コスト低 |
| スタイリング | **Tailwind CSS** | ユーティリティクラスで迅速にデザイン |
| データ永続化 | **IndexedDB + Dexie.js (JS)** | オフライン大容量ストレージを簡潔 API で操作 |
| ビルドツール | **Vite** | 高速 HMR とビルド |
| 状態管理 | Svelte store | 小規模アプリに十分 |
| PWA | Workbox, Web App Manifest | キャッシュ戦略とインストール機能 |
| テスト | Vitest (ユニット), Playwright (E2E) | 自動化テストで品質保証 |

---

## フォルダ構成例

```
/src
  ├─ App.svelte
  ├─ components/
  │    ├─ TaskForm.svelte
  │    ├─ TaskBoard.svelte
  │    └─ HistoryView.svelte
  ├─ db.js
  ├─ stores.js
  └─ sw.js
/public
  ├─ index.html
  └─ manifest.json
vite.config.js
tailwind.config.js
```
