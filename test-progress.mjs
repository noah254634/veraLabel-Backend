#!/usr/bin/env node

/**
 * Progress System Test
 * Tests the dataset splitter progress streaming system
 */

const BASE_URL = 'http://localhost:3000/api/v1';
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || '';

async function testProgressSystem() {
  console.log('🧪 Testing Progress System...\n');

  const projectId = 'test-project-' + Date.now();
  const datasetId = 'test-dataset-' + Date.now();

  try {
    // Test 1: Create a progress session by sending events
    console.log('📤 Test 1: Sending progress events...');
    const progressResponse = await fetch(`${BASE_URL}/tasks/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_TOKEN ? { 'Authorization': `Bearer ${BACKEND_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        projectId,
        datasetId,
        events: [
          {
            type: 'progress',
            timestamp: new Date().toISOString(),
            message: 'Started processing dataset',
            metadata: { count: 0 }
          },
          {
            type: 'progress',
            timestamp: new Date().toISOString(),
            message: 'Processed 100 items',
            metadata: { count: 100 }
          },
        ],
        isFinal: false,
      }),
    });

    if (!progressResponse.ok) {
      console.error('❌ Failed to send progress events:', progressResponse.status);
      const text = await progressResponse.text();
      console.error(text);
      return;
    }

    const progressData = await progressResponse.json();
    console.log('✅ Progress events sent:', progressData.message);
    console.log('   Session ID:', progressData.sessionId);
    console.log('   Status:', progressData.sessionStatus);

    // Test 2: Get session status
    console.log('\n📊 Test 2: Fetching session status...');
    const statusResponse = await fetch(
      `${BASE_URL}/tasks/progress/${projectId}/${datasetId}`,
      {
        headers: {
          ...(BACKEND_TOKEN ? { 'Authorization': `Bearer ${BACKEND_TOKEN}` } : {}),
        },
      }
    );

    if (!statusResponse.ok) {
      console.error('❌ Failed to fetch session status:', statusResponse.status);
      return;
    }

    const status = await statusResponse.json();
    console.log('✅ Session status retrieved:');
    console.log('   Duration:', status.data.durationMs, 'ms');
    console.log('   Events:', status.data.eventCounts);
    console.log('   Errors:', status.data.errorCount);

    // Test 3: Test error event
    console.log('\n⚠️  Test 3: Sending error event...');
    const errorResponse = await fetch(`${BASE_URL}/tasks/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_TOKEN ? { 'Authorization': `Bearer ${BACKEND_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        projectId,
        datasetId,
        events: [
          {
            type: 'error',
            timestamp: new Date().toISOString(),
            message: 'Test error event',
            error: { message: 'Test error', code: 'TEST_ERROR' },
            severity: 'warning'
          },
        ],
        isFinal: false,
      }),
    });

    if (!errorResponse.ok) {
      console.error('❌ Failed to send error event:', errorResponse.status);
      return;
    }

    console.log('✅ Error event sent');

    // Test 4: Send completion event
    console.log('\n✨ Test 4: Sending completion event...');
    const completeResponse = await fetch(`${BASE_URL}/tasks/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_TOKEN ? { 'Authorization': `Bearer ${BACKEND_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        projectId,
        datasetId,
        events: [
          {
            type: 'complete',
            timestamp: new Date().toISOString(),
            summary: {
              success: true,
              count: 1000,
              failedBatches: 0,
              totalDurationMs: 5000,
            },
          },
        ],
        isFinal: true,
      }),
    });

    if (!completeResponse.ok) {
      console.error('❌ Failed to send completion event:', completeResponse.status);
      return;
    }

    console.log('✅ Completion event sent');

    // Test 5: Get final summary
    console.log('\n📋 Test 5: Fetching final summary...');
    const finalResponse = await fetch(
      `${BASE_URL}/tasks/progress/${projectId}/${datasetId}`,
      {
        headers: {
          ...(BACKEND_TOKEN ? { 'Authorization': `Bearer ${BACKEND_TOKEN}` } : {}),
        },
      }
    );

    if (!finalResponse.ok) {
      console.error('❌ Failed to fetch final summary:', finalResponse.status);
      return;
    }

    const finalStatus = await finalResponse.json();
    console.log('✅ Final summary:');
    console.log('   Status:', finalStatus.data.status);
    console.log('   Total Events:', Object.values(finalStatus.data.eventCounts).reduce((a, b) => a + b, 0));
    console.log('   Duration:', finalStatus.data.durationMs, 'ms');

    console.log('\n✅ All tests passed!');
    console.log('\nEndpoints to test:\n');
    console.log(`   POST ${BASE_URL}/tasks/progress`);
    console.log(`   GET ${BASE_URL}/tasks/progress/${projectId}/${datasetId}`);
    console.log(`   GET ${BASE_URL}/tasks/progress/${projectId}/${datasetId}/stream`);
    console.log(`   GET ${BASE_URL}/tasks/progress/admin/sessions`);
    console.log(`   DELETE ${BASE_URL}/tasks/progress/${projectId}/${datasetId}`);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testProgressSystem();
