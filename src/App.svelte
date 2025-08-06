<script>
  import { onMount } from 'svelte'
  import { 
    initializeApp, 
    currentView, 
    loading, 
    error, 
    uiActions 
  } from './stores.js'
  
  // コンポーネントのインポート（後で実装）
  import TaskForm from './components/TaskForm.svelte'
  import TaskBoard from './components/TaskBoard.svelte'
  import HistoryView from './components/HistoryView.svelte'
  import SettingsView from './components/SettingsView.svelte'
  import LoadingSpinner from './components/LoadingSpinner.svelte'
  import ErrorMessage from './components/ErrorMessage.svelte'

  // アプリ初期化
  onMount(async () => {
    await initializeApp()
  })

  // ナビゲーション
  const navigationItems = [
    { key: 'main', label: 'メイン', icon: '📋' },
    { key: 'history', label: '履歴', icon: '📊' },
    { key: 'settings', label: '設定', icon: '⚙️' }
  ]

  function handleNavigation(view) {
    uiActions.setView(view)
  }
</script>

<main class="min-h-screen bg-gray-50">
  <!-- ヘッダー -->
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <!-- タイトル -->
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-gray-900">
            📋 ToDo App - 緊急性管理
          </h1>
        </div>

        <!-- ナビゲーション -->
        <nav class="flex space-x-4">
          {#each navigationItems as item}
            <button
              type="button"
              class="flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                     {$currentView === item.key 
                       ? 'bg-blue-100 text-blue-700' 
                       : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}"
              on:click={() => handleNavigation(item.key)}
            >
              <span class="mr-1">{item.icon}</span>
              {item.label}
            </button>
          {/each}
        </nav>
      </div>
    </div>
  </header>

  <!-- メインコンテンツ -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    
    <!-- エラー表示 -->
    {#if $error}
      <div class="mb-6">
        <ErrorMessage />
      </div>
    {/if}

    <!-- ローディング表示 -->
    {#if $loading}
      <div class="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    {/if}

    <!-- メインビュー -->
    {#if $currentView === 'main'}
      <div class="space-y-6">
        <!-- タスク入力フォーム -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">新しいタスク</h2>
          <TaskForm />
        </div>

        <!-- タスクボード -->
        <div class="bg-white rounded-lg shadow p-6">
          <TaskBoard />
        </div>
      </div>

    {:else if $currentView === 'history'}
      <div class="bg-white rounded-lg shadow p-6">
        <HistoryView />
      </div>

    {:else if $currentView === 'settings'}
      <div class="bg-white rounded-lg shadow p-6">
        <SettingsView />
      </div>
    {/if}
  </div>

  <!-- フッター -->
  <footer class="bg-white border-t border-gray-200 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="text-center text-sm text-gray-500">
        ToDo App - 工数・重要度・締切から緊急性を自動計算
      </div>
    </div>
  </footer>
</main>

<style>
  /* 全体的なスタイル調整 */
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  /* アニメーション */
  :global(.fade-in) {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* フォーカス可視性の向上 */
  :global(button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible) {
    outline: 2px solid #3B82F6;
    outline-offset: 2px;
  }

  /* スクロール可能エリアのスタイル */
  :global(.scrollable) {
    scrollbar-width: thin;
    scrollbar-color: #CBD5E0 #F7FAFC;
  }

  :global(.scrollable::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.scrollable::-webkit-scrollbar-track) {
    background: #F7FAFC;
    border-radius: 4px;
  }

  :global(.scrollable::-webkit-scrollbar-thumb) {
    background: #CBD5E0;
    border-radius: 4px;
  }

  :global(.scrollable::-webkit-scrollbar-thumb:hover) {
    background: #A0AEC0;
  }
</style>