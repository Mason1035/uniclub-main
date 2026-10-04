import React, { useState, useEffect } from 'react';

const DebugPage: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({});
  const [testResults, setTestResults] = useState<Record<string, unknown>>({});

  useEffect(() => {
    // Get debug info about current state
    const token = localStorage.getItem('token');
    const authToken = localStorage.getItem('authToken'); // Check if it's stored differently
    
    setDebugInfo({
      token: token ? `${token.substring(0, 20)}...` : 'No token',
      authToken: authToken ? `${authToken.substring(0, 20)}...` : 'No authToken',
      localStorage: Object.keys(localStorage),
      currentUrl: window.location.href
    });
  }, []);

  const testHealthEndpoint = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        health: { status: response.status, data }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        health: { error: error.message }
      }));
    }
  };

  const testUserProfile = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        userProfile: { status: response.status, data }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        userProfile: { error: error.message }
      }));
    }
  };

  const testEngagementEndpoint = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch('/api/engagement/user/News/123456789012345678901234', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        engagement: { status: response.status, data }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        engagement: { error: error.message }
      }));
    }
  };

  const testUploadFile = async () => {
    try {
      // Create a test file
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], 'test-avatar.png', { type: 'image/png' });
        const formData = new FormData();
        formData.append('avatar', file);

        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch('/api/users/avatar', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        const data = await response.json();
        setTestResults(prev => ({
          ...prev,
          upload: { status: response.status, data }
        }));
      }, 'image/png');
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        upload: { error: error.message }
      }));
    }
  };

  return (
          <div className="page-shell debug-page">
      <div className="debug-workspace">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-8">
          连接诊断
        </h1>

        {/* Debug Info */}
        <div className="content-card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">当前状态</h2>
          <pre className="bg-background dark:bg-card p-4 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={testHealthEndpoint}
            className="ed-button"
          >
            检查服务连接
          </button>
          <button
            onClick={testUserProfile}
            className="ed-button"
          >
            检查个人资料
          </button>
          <button
            onClick={testEngagementEndpoint}
            className="ed-button"
          >
            检查互动接口
          </button>
          <button
            onClick={testUploadFile}
            className="ed-button"
          >
            检查上传连接
          </button>
        </div>

        {/* Test Results */}
        <div className="content-card p-6">
          <h2 className="text-xl font-semibold mb-4">测试结果</h2>
          <pre className="bg-background dark:bg-card p-4 rounded text-sm overflow-auto h-96">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>

        {/* Instructions */}
        <div className="content-card mt-6 p-4">
          <h3 className="font-medium text-foreground dark:text-foreground mb-2">
            使用说明
          </h3>
          <ol className="text-sm text-foreground dark:text-foreground space-y-1">
            <li>1. 请先登录班级网站</li>
            <li>2. 检查服务连接 to verify backend connection</li>
            <li>3. 检查个人资料 to check authentication</li>
            <li>4. 检查互动接口 to verify new API</li>
            <li>5. 检查上传连接 to check file upload</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DebugPage; 