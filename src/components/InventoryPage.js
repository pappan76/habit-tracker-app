import React, { useState } from 'react';

const InventoryPage = () => {
  const [products, setProducts] = useState([
    // Cleaning Products
    { 
      id: 1, 
      category: 'Cleaning', 
      name: 'All-Purpose Cleaner', 
      xBrand: 'Generic Multi-Surface Cleaner - $3.99/32oz', 
      amway: 'L.O.C. Multi-Purpose Cleaner - $12.95/32oz concentrate' 
    },
    { 
      id: 2, 
      category: 'Cleaning', 
      name: 'Dish Soap', 
      xBrand: 'Dawn Original - $2.49/24oz', 
      amway: 'DISH DROPS Concentrated Dishwashing Liquid - $8.60/25oz concentrate' 
    },
    { 
      id: 3, 
      category: 'Cleaning', 
      name: 'Glass Cleaner', 
      xBrand: 'Windex Original - $3.29/32oz', 
      amway: 'L.O.C. Glass Cleaner - $7.95/32oz' 
    },
    
    // Laundry Products
    { 
      id: 4, 
      category: 'Laundry', 
      name: 'Laundry Detergent', 
      xBrand: 'Tide Original - $11.99/100oz', 
      amway: 'SA8 Powder Laundry Detergent - $23.50/6.6lbs' 
    },
    { 
      id: 5, 
      category: 'Laundry', 
      name: 'Fabric Softener', 
      xBrand: 'Downy April Fresh - $4.99/64oz', 
      amway: 'SA8 Fabric Softener - $12.95/64oz' 
    },
    { 
      id: 6, 
      category: 'Laundry', 
      name: 'Stain Remover', 
      xBrand: 'OxiClean MaxForce - $4.49/12oz', 
      amway: 'SA8 Pre-Wash Spray - $9.95/16oz' 
    },
    
    // Personal Care
    { 
      id: 7, 
      category: 'Personal Care', 
      name: 'Body Wash', 
      xBrand: 'Dove Deep Clean - $5.99/22oz', 
      amway: 'Artistry Studio Bangkok Edition Body Wash - $18.00/8.4oz' 
    },
    { 
      id: 8, 
      category: 'Personal Care', 
      name: 'Shampoo', 
      xBrand: 'Pantene Pro-V - $6.49/25.4oz', 
      amway: 'Satinique Anti-Dandruff Shampoo - $22.00/9.4oz' 
    },
    { 
      id: 9, 
      category: 'Personal Care', 
      name: 'Toothpaste', 
      xBrand: 'Crest Cavity Protection - $3.99/6.4oz', 
      amway: 'Glister Multi-Action Fluoride Toothpaste - $7.35/6.75oz' 
    },
    
    // Kitchen Products
    { 
      id: 10, 
      category: 'Kitchen', 
      name: 'Paper Towels', 
      xBrand: 'Bounty Select-A-Size - $12.99/8 rolls', 
      amway: 'Legacy of Clean Paper Towels - $15.95/6 rolls' 
    },
    { 
      id: 11, 
      category: 'Kitchen', 
      name: 'Aluminum Foil', 
      xBrand: 'Reynolds Wrap Standard - $4.99/75 sq ft', 
      amway: 'Not Available' 
    },
    { 
      id: 12, 
      category: 'Kitchen', 
      name: 'Trash Bags', 
      xBrand: 'Glad ForceFlexPlus - $13.49/80 count', 
      amway: 'Not Available' 
    }
  ]);

  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Cleaning',
    xBrand: '',
    amway: ''
  });

  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const categories = ['All', 'Cleaning', 'Laundry', 'Personal Care', 'Kitchen'];

  const categoryEmojis = {
    'Cleaning': '🧽',
    'Laundry': '👕',
    'Personal Care': '🧴',
    'Kitchen': '🍽️'
  };

  const addProduct = () => {
    if (newProduct.name.trim()) {
      const product = {
        id: Math.max(...products.map(p => p.id)) + 1,
        ...newProduct
      };
      setProducts([...products, product]);
      setNewProduct({
        name: '',
        category: 'Cleaning',
        xBrand: '',
        amway: ''
      });
      setShowModal(false);
    }
  };

  const deleteProduct = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(product => product.id !== id));
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.xBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.amway.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {});

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px'
    },
    header: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      color: 'white',
      padding: '40px',
      borderRadius: '12px',
      textAlign: 'center',
      marginBottom: '30px',
      boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
    },
    title: {
      fontSize: '2.5rem',
      marginBottom: '10px',
      fontWeight: '700'
    },
    subtitle: {
      fontSize: '1.1rem',
      opacity: '0.9'
    },
    controls: {
      backgroundColor: 'white',
      padding: '25px',
      borderRadius: '12px',
      marginBottom: '30px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr auto',
      gap: '15px',
      alignItems: 'center'
    },
    input: {
      padding: '12px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.3s ease'
    },
    button: {
      backgroundColor: '#3b82f6',
      color: 'white',
      padding: '12px 24px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    },
    table: {
      backgroundColor: 'white',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      width: '100%',
      borderCollapse: 'collapse'
    },
    thead: {
      backgroundColor: '#f8fafc'
    },
    th: {
      padding: '16px 20px',
      textAlign: 'left',
      fontWeight: '600',
      color: '#475569',
      fontSize: '14px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: '1px solid #e2e8f0'
    },
    td: {
      padding: '16px 20px',
      borderBottom: '1px solid #e2e8f0'
    },
    categoryRow: {
      backgroundColor: '#f1f5f9',
      fontWeight: '600',
      color: '#475569'
    },
    deleteButton: {
      color: '#dc2626',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      padding: '4px 8px',
      borderRadius: '4px',
      transition: 'all 0.2s ease'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '12px',
      maxWidth: '500px',
      width: '90%'
    },
    formGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '5px',
      fontWeight: '500',
      color: '#374151'
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>🏠 Household Products Inventory</h1>
          <p style={styles.subtitle}>Brand Comparison: X-Brand vs Amway Products</p>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          <input
            type="text"
            placeholder="🔍 Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.input}
          />
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={styles.input}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          
          <button
            onClick={() => setShowModal(true)}
            style={styles.button}
          >
            + Add Product
          </button>
        </div>

        {/* Products Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead style={styles.thead}>
              <tr>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>X-Brand (Generic)</th>
                <th style={styles.th}>Amway</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                <React.Fragment key={category}>
                  {/* Category Header */}
                  <tr style={styles.categoryRow}>
                    <td colSpan="4" style={{...styles.td, borderTop: '2px solid #cbd5e1'}}>
                      {categoryEmojis[category]} {category}
                    </td>
                  </tr>
                  {/* Products in Category */}
                  {categoryProducts.map(product => (
                    <tr key={product.id} style={{ backgroundColor: 'white' }}>
                      <td style={{...styles.td, fontWeight: '500', color: '#1e293b'}}>
                        {product.name}
                      </td>
                      <td style={{...styles.td, color: '#64748b'}}>
                        {product.xBrand}
                      </td>
                      <td style={{...styles.td, color: '#059669', fontWeight: '500'}}>
                        {product.amway}
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          style={styles.deleteButton}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '16px' }}>
            No products found matching your criteria.
          </div>
        )}

        {/* Add Product Modal */}
        {showModal && (
          <div style={styles.modal}>
            <div style={styles.modalContent}>
              <h3 style={{ marginBottom: '20px', color: '#1e293b', fontSize: '1.5rem' }}>Add New Product</h3>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Product Name</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  style={styles.input}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  style={styles.input}
                >
                  {categories.slice(1).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>X-Brand Details</label>
                <input
                  type="text"
                  placeholder="Brand name, price, size..."
                  value={newProduct.xBrand}
                  onChange={(e) => setNewProduct({...newProduct, xBrand: e.target.value})}
                  style={styles.input}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Amway Details</label>
                <input
                  type="text"
                  placeholder="Product name, price, size..."
                  value={newProduct.amway}
                  onChange={(e) => setNewProduct({...newProduct, amway: e.target.value})}
                  style={styles.input}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button
                  onClick={addProduct}
                  style={{...styles.button, flex: 1}}
                >
                  Add Product
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  style={{...styles.button, backgroundColor: '#6b7280', flex: 1}}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryPage;