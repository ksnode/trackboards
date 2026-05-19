import { useState } from 'react';
import BoardFramework from '../components/BoardFramework/BoardFramework';

const MOCK_DATA = {
  modules: [
    {
      id: 'mod-react',
      title: 'React — Fundamentals',
      color: '#6366f1',
      tag: 'main',
      tagLabel: 'Maj–Czerwiec',
      tree: [
        {
          id: 'react-1',
          label: 'Instalacja + pierwsze komponenty',
          hours: 1.5,
          children: [],
        },
        {
          id: 'react-2',
          label: 'Hooks i zarządzanie stanem',
          hours: 0,
          children: [
            { id: 'react-2a', label: 'useState, useEffect', hours: 2, children: [] },
            { id: 'react-2b', label: 'useContext + custom hooks', hours: 1.5, children: [] },
            {
              id: 'react-2c',
              label: 'useReducer + useMemo',
              hours: 0,
              children: [
                { id: 'react-2c-i', label: 'useReducer basics', hours: 1, children: [] },
                { id: 'react-2c-ii', label: 'useMemo / useCallback', hours: 1, children: [] },
              ],
            },
          ],
        },
        {
          id: 'react-3',
          label: 'Routing z React Router v6',
          hours: 2,
          children: [],
        },
      ],
    },
    {
      id: 'mod-css',
      title: 'CSS Modules — praktyka',
      color: '#16a34a',
      tag: 'optional',
      tagLabel: '',
      tree: [
        { id: 'css-1', label: 'Konfiguracja Vite + CSS Modules', hours: 0.5, children: [] },
        { id: 'css-2', label: 'Responsive design', hours: 2, children: [] },
      ],
    },
    {
      id: 'mod-placeholder',
      title: 'Przyszłe tematy',
      color: '#888780',
      tag: 'placeholder',
      tagLabel: 'Kiedyś',
      tree: [
        { id: 'ph-1', label: 'GraphQL', hours: 10, children: [] },
        { id: 'ph-2', label: 'WebSockets', hours: 5, children: [] },
      ],
    },
  ],
};

const MOCK_PROGRESS = {
  states: {
    'react-1': 'done',
    'react-2a': 'done',
    'react-2b': 'skip',
    'css-1': 'done',
  },
  collapsed: {
    'mod-placeholder': true,
  },
};

export default function TestFramework() {
  const [data, setData] = useState(MOCK_DATA);
  const [progress, setProgress] = useState(MOCK_PROGRESS);

  const handleChange = (newData, newProgress) => {
    setData(newData);
    setProgress(newProgress);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 740, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
        BoardFramework — Test Page
      </h1>
      <BoardFramework
        boardId="test-123"
        data={data}
        progress={progress}
        onChange={handleChange}
        readOnly={false}
        canEditStructure={true}
      />
    </div>
  );
}
