import { useState } from 'react';
import Onboarding from './components/Onboarding';
import ScheduleView from './components/ScheduleView';
import { clearSelection, loadSelection, saveSelection } from './storage';
import type { SavedSelection } from './types';
import './App.css';

export default function App() {
  const [selection, setSelection] = useState<SavedSelection | null>(() => loadSelection());

  function handleSelect(next: SavedSelection) {
    saveSelection(next);
    setSelection(next);
  }

  function handleChangeGroup() {
    clearSelection();
    setSelection(null);
  }

  if (!selection) {
    return <Onboarding onSelect={handleSelect} />;
  }

  return <ScheduleView selection={selection} onChangeGroup={handleChangeGroup} />;
}
