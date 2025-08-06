<script>
  import { onMount } from 'svelte'
  import { settings, settingsForm, settingsActions, loading } from '../stores.js'
  import LoadingSpinner from './LoadingSpinner.svelte'

  let customFormula = ''
  let customDescription = ''
  let highThreshold = 10
  let mediumThreshold = 3
  let testEffort = 2
  let testImportance = 3
  let testDaysLeft = 1
  let testResult = 0

  // 設定の読み込み
  onMount(async () => {
    await settingsActions.loadSettings()
  })

  // 現在の設定から値を更新
  $: if ($settings.urgency_formula) {
    customFormula = $settings.urgency_formula.formula
    customDescription = $settings.urgency_formula.description
  }

  $: if ($settings.urgency_thresholds) {
    highThreshold = $settings.urgency_thresholds.high
    mediumThreshold = $settings.urgency_thresholds.medium
  }

  // テスト計算
  $: testResult = (() => {
    try {
      if (!customFormula) return 0
      
      const effort = testEffort
      const importance = testImportance
      const daysLeft = Math.max(0.1, testDaysLeft) // 0にならないよう調整
      
      const result = Function('effort', 'importance', 'daysLeft', `return ${customFormula}`)(
        effort, importance, daysLeft
      )
      
      return isNaN(result) ? 0 : result
    } catch (error) {
      return '数式エラー'
    }
  })()

  // 事前定義された計算式
  const presetFormulas = [
    {
      name: 'デフォルト',
      formula: '(effort * importance) / Math.max(0.1, Math.pow(daysLeft, 1.5))',
      description: '工数×重要度を残り日数^1.5で割る（指数的減衰）'
    },
    {
      name: '線形',
      formula: '(effort * importance) / Math.max(0.1, daysLeft)',
      description: '工数×重要度を残り日数で割る（線形）'
    },
    {
      name: '重要度重視',
      formula: '(effort * Math.pow(importance, 2)) / Math.max(0.1, daysLeft)',
      description: '重要度を二乗して重みを増加'
    },
    {
      name: '工数重視',
      formula: '(Math.pow(effort, 1.5) * importance) / Math.max(0.1, daysLeft)',
      description: '工数を1.5乗して大きなタスクにより高いスコア'
    },
    {
      name: '期限重視',
      formula: '(effort * importance) / Math.max(0.1, Math.pow(daysLeft, 2))',
      description: '残り日数の二乗で割り、期限の近いタスクを強調'
    }
  ]

  // 事前定義式の適用
  function applyPreset(preset) {
    customFormula = preset.formula
    customDescription = preset.description
  }

  // 設定保存
  async function saveSettings() {
    if (!customFormula.trim()) {
      alert('計算式を入力してください')
      return
    }

    // 計算式のテスト実行
    try {
      Function('effort', 'importance', 'daysLeft', `return ${customFormula}`)(1, 1, 1)
    } catch (error) {
      alert('計算式にエラーがあります: ' + error.message)
      return
    }

    await Promise.all([
      settingsActions.updateUrgencyFormula(customFormula, customDescription),
      settingsActions.updateUrgencyThresholds({
        high: highThreshold,
        medium: mediumThreshold
      })
    ])

    alert('設定が保存されました！')
  }

  // 設定リセット
  async function resetSettings() {
    if (confirm('設定をデフォルトに戻しますか？')) {
      const defaultPreset = presetFormulas[0]
      customFormula = defaultPreset.formula
      customDescription = defaultPreset.description
      highThreshold = 10
      mediumThreshold = 3
    }
  }
</script>

<div class="max-w-4xl mx-auto space-y-8">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold text-gray-900">⚙️ 設定</h2>
  </div>

  <!-- 緊急性計算式設定 -->
  <div class="bg-white border border-gray-200 rounded-lg p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-4">📊 緊急性計算式</h3>
    
    <!-- 事前定義式 -->
    <div class="mb-6">
      <h4 class="text-sm font-medium text-gray-700 mb-3">事前定義式</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {#each presetFormulas as preset}
          <button
            type="button"
            class="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            on:click={() => applyPreset(preset)}
          >
            <div class="font-medium text-gray-900">{preset.name}</div>
            <div class="text-xs text-gray-500 mt-1 font-mono">
              {preset.formula}
            </div>
            <div class="text-sm text-gray-600 mt-1">{preset.description}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- カスタム計算式 -->
    <div class="space-y-4">
      <div>
        <label for="custom-formula" class="block text-sm font-medium text-gray-700 mb-2">
          カスタム計算式
        </label>
        <textarea
          id="custom-formula"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          rows="3"
          placeholder="(effort * importance) / Math.max(0.1, Math.pow(daysLeft, 1.5))"
          bind:value={customFormula}
        ></textarea>
        <p class="mt-1 text-sm text-gray-500">
          利用可能な変数: <code>effort</code> (工数), <code>importance</code> (重要度), <code>daysLeft</code> (残り日数)
        </p>
      </div>

      <div>
        <label for="custom-description" class="block text-sm font-medium text-gray-700 mb-2">
          説明（オプション）
        </label>
        <input
          id="custom-description"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="この計算式の説明..."
          bind:value={customDescription}
        />
      </div>
    </div>

    <!-- テスト計算 -->
    <div class="mt-6 p-4 bg-gray-50 rounded-lg">
      <h4 class="text-sm font-medium text-gray-700 mb-3">🧪 計算式テスト</h4>
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-xs text-gray-600 mb-1">工数 (時間)</label>
          <input
            type="number"
            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            min="0.1"
            step="0.1"
            bind:value={testEffort}
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">重要度 (1-5)</label>
          <input
            type="number"
            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            min="1"
            max="5"
            bind:value={testImportance}
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">残り日数</label>
          <input
            type="number"
            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            min="0"
            step="0.1"
            bind:value={testDaysLeft}
          />
        </div>
      </div>
      <div class="text-center">
        <span class="text-sm text-gray-600">緊急性スコア: </span>
        <span class="text-lg font-bold text-blue-600">
          {typeof testResult === 'number' ? testResult.toFixed(2) : testResult}
        </span>
      </div>
    </div>
  </div>

  <!-- 緊急性レベル閾値設定 -->
  <div class="bg-white border border-gray-200 rounded-lg p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 緊急性レベル閾値</h3>
    
    <div class="grid grid-cols-2 gap-6">
      <div>
        <label for="high-threshold" class="block text-sm font-medium text-gray-700 mb-2">
          高緊急度の閾値
        </label>
        <input
          id="high-threshold"
          type="number"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          min="0"
          step="0.1"
          bind:value={highThreshold}
        />
        <p class="mt-1 text-sm text-gray-500">この値以上で高緊急度（赤）</p>
      </div>
      
      <div>
        <label for="medium-threshold" class="block text-sm font-medium text-gray-700 mb-2">
          中緊急度の閾値
        </label>
        <input
          id="medium-threshold"
          type="number"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          min="0"
          step="0.1"
          bind:value={mediumThreshold}
        />
        <p class="mt-1 text-sm text-gray-500">この値以上で中緊急度（黄）、未満は低緊急度（青）</p>
      </div>
    </div>

    <!-- 閾値の視覚的表示 -->
    <div class="mt-4 p-3 bg-gradient-to-r from-blue-100 via-yellow-100 to-red-100 rounded-lg">
      <div class="flex justify-between items-center text-sm">
        <span class="text-blue-700 font-medium">低 (0-{mediumThreshold})</span>
        <span class="text-yellow-700 font-medium">中 ({mediumThreshold}-{highThreshold})</span>
        <span class="text-red-700 font-medium">高 ({highThreshold}+)</span>
      </div>
    </div>
  </div>

  <!-- 保存・リセットボタン -->
  <div class="flex justify-between">
    <button
      type="button"
      class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
      on:click={resetSettings}
    >
      🔄 デフォルトに戻す
    </button>
    
    <button
      type="button"
      class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      on:click={saveSettings}
      disabled={$loading}
    >
      {#if $loading}
        <LoadingSpinner size="sm" color="white" />
        <span class="ml-2">保存中...</span>
      {:else}
        💾 設定を保存
      {/if}
    </button>
  </div>

  <!-- 現在の設定表示 -->
  {#if $settings.urgency_formula}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 class="font-medium text-blue-900 mb-2">📋 現在の設定</h4>
      <div class="space-y-2">
        <div>
          <span class="text-sm text-blue-700 font-medium">計算式:</span>
          <code class="ml-2 text-sm bg-white px-2 py-1 rounded border">{$settings.urgency_formula.formula}</code>
        </div>
        {#if $settings.urgency_formula.description}
          <div>
            <span class="text-sm text-blue-700 font-medium">説明:</span>
            <span class="ml-2 text-sm text-blue-600">{$settings.urgency_formula.description}</span>
          </div>
        {/if}
        <div>
          <span class="text-sm text-blue-700 font-medium">閾値:</span>
          <span class="ml-2 text-sm text-blue-600">高: {$settings.urgency_thresholds?.high || 10}, 中: {$settings.urgency_thresholds?.medium || 3}</span>
        </div>
      </div>
    </div>
  {/if}
</div>