/**
 * OpenCode Memory Plugin - External Service Validation
 * Checks if the default embedding service is available at startup
 */

async function validateExternalService(endpoint = 'http://localhost:18000/embeddings') {
  try {
    // Importing fetch for Node.js environment (would normally be available in modern Node)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: 'test',
        model: 'default'
      })
    });
    
    if (response.ok) {
      console.log('✓ External embedding service is accessible');
      return true;
    } else {
      console.log('⚠ External embedding service returned error, will use fallback methods');
      return false;
    }
  } catch (error) {
    console.log('⚠ External embedding service not accessible:', error.message);
    console.log('  Will use fallback BM25 keyword search until service is available');
    return false;
  }
}

module.exports = { validateExternalService };