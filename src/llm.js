// LLM Engine - works with any OpenAI-compatible API
// Falls back to rule-based if no API key

class LLM {
  constructor() {
    this.apiKey = process.env.PILOT_AI_KEY || null;
    this.apiUrl = process.env.PILOT_AI_URL || 'https://api.openai.com/v1/chat/completions';
    this.model = process.env.PILOT_AI_MODEL || 'gpt-3.5-turbo';
  }

  isAvailable() {
    return this.apiKey !== null;
  }

  async explain(error) {
    if (!this.isAvailable()) {
      return this.offlineExplain(error);
    }

    try {
      const prompt = `You are a developer assistant inside a mobile terminal (Termux on Android).

A process named "${error.process}" crashed with this error:

${error.rawError}

Error type: ${error.type}
Detected cause: ${error.cause}

Explain this error in 2-3 simple sentences a beginner would understand.
Then give exactly 3 actionable fix steps.

Reply in this format:
EXPLAIN: (your explanation)
FIX1: (step 1)
FIX2: (step 2)
FIX3: (step 3)`;

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.apiKey
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.3
        })
      });

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';

      const explain = text.match(/EXPLAIN:\s*(.+?)(?=FIX1:|$)/s)?.[1]?.trim() || '';
      const fix1 = text.match(/FIX1:\s*(.+?)(?=FIX2:|$)/s)?.[1]?.trim() || '';
      const fix2 = text.match(/FIX2:\s*(.+?)(?=FIX3:|$)/s)?.[1]?.trim() || '';
      const fix3 = text.match(/FIX3:\s*(.+?)$/s)?.[1]?.trim() || '';

      return {
        source: 'llm',
        explanation: explain,
        fixes: [fix1, fix2, fix3].filter(Boolean),
        raw: text
      };
    } catch (e) {
      return this.offlineExplain(error);
    }
  }

  offlineExplain(error) {
    const explanations = {
      'FILE_NOT_FOUND': 'The file your program is trying to run does not exist at the specified path. This usually means the filename is wrong or you are in the wrong directory.',
      'PACKAGE_NOT_FOUND': 'Your code requires a package that is not installed. Node.js cannot find it in node_modules. You need to install it first.',
      'PORT_IN_USE': 'Another program is already using the same port number. Two programs cannot listen on the same port at the same time.',
      'SYNTAX_ERROR': 'There is a typo or mistake in your code. JavaScript cannot understand what you wrote because of a missing bracket, comma, or keyword.',
      'TYPE_ERROR': 'Your code tried to use a value in a wrong way. For example, calling a function on something that is null or undefined.',
      'REFERENCE_ERROR': 'Your code uses a variable or function name that does not exist. It was never created or it is misspelled.',
      'CONNECTION_REFUSED': 'Your program tried to connect to a server or database that is not running. The connection was rejected.',
      'PERMISSION_DENIED': 'Your program does not have permission to access a file or port. You may need to change file permissions.',
      'OUT_OF_MEMORY': 'Your program used too much memory and the system killed it. This can happen with large data or memory leaks.',
      'TIMEOUT': 'A network request took too long and was cancelled. The remote server may be slow or unreachable.',
      'PYTHON_MODULE_MISSING': 'Your Python script needs a module that is not installed. You need to install it with pip.',
      'PYTHON_INDENT': 'Python code has wrong spacing. Python uses indentation to understand code structure. Make sure you use consistent spaces.',
      'PYTHON_NAME_ERROR': 'Your Python code uses a name that was never defined. Check for typos or missing imports.',
      'UNHANDLED_PROMISE': 'An async operation failed but the error was not caught. Add error handling to your promises.',
      'PROCESS_KILLED': 'The system force-stopped your program, usually because it used too much memory.',
      'NETWORK_ERROR': 'A network request failed. Check your internet connection or the URL.'
    };

    return {
      source: 'offline',
      explanation: explanations[error.type] || 'An error occurred in your program. Check the error message and fix the issue.',
      fixes: error.fixes || [],
      raw: null
    };
  }
}

module.exports = new LLM();
