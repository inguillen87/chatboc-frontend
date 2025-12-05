import React from 'react';
import ProductCatalog from '@/pages/ProductCatalog';

const UserCatalogPage = () => {
  // ProductCatalog is self-contained with its own layout, search, and logic.
  // We render it directly here to provide the full catalog experience within the user portal.
  return <ProductCatalog />;
};

export default UserCatalogPage;
