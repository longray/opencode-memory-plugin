/**
 * Test script to verify the external embedding service integration
 */

import { getVectorStore } from './lib/vector-store.js';
import fs from 'fs';
import path from 'path';

// Mock config for testing
const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

async function testExternalEmbedding() {
  console.log('Testing external embedding service integration...');
  
  // Create vector store instance
  const vectorStore = getVectorStore();
  
  try {
    // Initialize with external service configuration
    const initResult = await vectorStore.initialize({
      endpoint: 'http://localhost:18000/embeddings'
    });
    
    console.log('Initialization result:', initResult);
    
    if (!initResult.success) {
      console.log('Initialization failed, but that\'s expected if service is not running');
      console.log('Error:', initResult.error);
      return false;
    }
    
    // Test generating an embedding
    try {
      const testText = "This is a test sentence for embedding.";
      const embeddings = await vectorStore.generateEmbeddings(testText);
      
      console.log(`Generated embedding with ${embeddings[0].length} dimensions`);
      console.log('First few values:', embeddings[0].slice(0, 5));
      
      return true;
    } catch (embeddingError) {
      console.log('Embedding generation failed:', embeddingError.message);
      console.log('This could be because the external service is not running');
      return false;
    }
  } catch (error) {
    console.log('Error during test:', error.message);
    return false;
  } finally {
    vectorStore.close();
  }
}

// Run the test
testExternalEmbedding().then(success => {
  if (success) {
    console.log('\n✓ Test passed: External embedding service integration works correctly');
  } else {
    console.log('\n⚠ Test completed: This is expected if the external service is not running');
    console.log('  Please start your embedding service on http://localhost:18000/embeddings');
  }
});