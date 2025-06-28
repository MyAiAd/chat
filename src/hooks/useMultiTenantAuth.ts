import { useContext } from 'react';
import { MultiTenantAuthContext } from '../contexts/MultiTenantAuthContext';

export const useMultiTenantAuth = () => {
  const context = useContext(MultiTenantAuthContext);
  
  if (context === undefined) {
    throw new Error('useMultiTenantAuth must be used within a MultiTenantAuthProvider');
  }
  
  return context;
}; 