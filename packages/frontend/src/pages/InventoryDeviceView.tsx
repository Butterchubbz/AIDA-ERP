import React, { useState } from 'react';
import DeviceList from './DeviceList';
import DeviceForm from '../components/modules/DeviceForm';
import type { DeviceItem } from '@aida/shared';
import { useDeviceContext } from '../context/DeviceContext';
import { useMessageBox } from '../components/common/MessageBox';
import PageContainer from '../components/common/PageContainer';

const InventoryDeviceView: React.FC = () => {
  const { addDeviceItem, updateDeviceItem } = useDeviceContext();
  const { showToast } = useMessageBox();

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DeviceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddItem = () => {
    setItemToEdit(null);
    setShowAddItemModal(true);
  };

  const handleEditItem = (item: DeviceItem) => {
    setItemToEdit(item);
    setShowEditItemModal(true);
  };

  const handleCloseModal = () => {
    setShowAddItemModal(false);
    setShowEditItemModal(false);
    setItemToEdit(null);
  };

  const handleSubmitForm = async (item: Partial<DeviceItem>) => {
    setIsSubmitting(true);
    try {
      if (itemToEdit && itemToEdit.id) {
        // Editing existing item
        await updateDeviceItem(itemToEdit.id, item);
        showToast('Item updated successfully!', 'success');
      } else {
        // Adding new item
        await addDeviceItem(item);
        showToast('Item added successfully!', 'success');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error submitting inventory item:', error);
      showToast('Failed to save item.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageContainer title="Device List" icon="fas fa-mobile-alt">
        <DeviceList onAddItem={handleAddItem} onEditItem={handleEditItem} />
      </PageContainer>

      {(showAddItemModal || showEditItemModal) && (
        <DeviceForm
          isOpen={showAddItemModal || showEditItemModal}
          onClose={handleCloseModal}
          onSubmit={handleSubmitForm}
          initialData={itemToEdit}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
};

export default InventoryDeviceView;
