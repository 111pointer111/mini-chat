/**
 * Auth 页面共享样式（深色毛玻璃风格）
 */

// 输入框样式
export const authInputSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.15)',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#818cf8',
            borderWidth: 2,
        },
        '& input, & input[type="password"]': {
            color: '#e2e8f0',
        },
    },
    '& .MuiInputLabel-root': {
        color: 'rgba(255, 255, 255, 0.5)',
        '&.Mui-focused': {
            color: '#818cf8',
        },
    },
    '& .MuiFormHelperText-root': {
        color: 'rgba(255, 255, 255, 0.4)',
    },
};

// Tab 样式
export const authTabsSx = {
    mb: 2.5,
    minHeight: 42,
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    p: 0.5,
    '& .MuiTabs-flexContainer': {
        gap: 0.5,
    },
    '& .MuiTab-root': {
        color: 'rgba(255,255,255,0.45)',
        fontWeight: 600,
        fontSize: '0.85rem',
        textTransform: 'none',
        minHeight: 34,
        minWidth: 0,
        flex: 1,
        borderRadius: '10px',
        '&.Mui-selected': {
            color: '#f8fafc',
            backgroundColor: 'rgba(129, 140, 248, 0.22)',
        },
    },
    '& .MuiTabs-indicator': {
        display: 'none',
    },
};

// 按钮样式
export const authButtonSx = {
    mt: 3,
    mb: 1,
    height: 48,
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
    textTransform: 'none',
    '&:hover': {
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        boxShadow: '0 6px 24px rgba(99, 102, 241, 0.5)',
    },
};

// 链接样式
export const authLinkSx = {
    color: '#a5b4fc',
    textDecoration: 'none',
    fontWeight: 500,
    '&:hover': { color: '#c7d2fe', textDecoration: 'underline' },
};

// Alert 样式
export const authAlertSx = {
    mb: 2,
    borderRadius: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    '& .MuiAlert-icon': { color: '#f87171' },
};

// 成功 Alert 样式
export const authSuccessAlertSx = {
    mb: 2,
    borderRadius: '10px',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: '#86efac',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    '& .MuiAlert-icon': { color: '#4ade80' },
};
