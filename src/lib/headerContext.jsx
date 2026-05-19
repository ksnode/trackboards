import { createContext, useContext, useState } from 'react';

const HeaderContext = createContext(null);

export function HeaderProvider({ children }) {
  const [header, setHeader] = useState({
    title: '',
    titleDraft: '',
    editable: false,
    onTitleChange: null,
    onTitleBlur: null,
    showBack: false,
  });
  return <HeaderContext.Provider value={{ header, setHeader }}>{children}</HeaderContext.Provider>;
}

export function useHeader() {
  return useContext(HeaderContext);
}
