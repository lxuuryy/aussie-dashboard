'use client';

import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Loader,
  Package,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ShippingContainersManager = ({ order, onClose, onUpdate }) => {
  const [containers, setContainers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tracking methods available
  const trackingMethods = [
    { value: "BL_TRACKING", label: "Bill of Lading (BL)", description: "Track by Bill of Lading number" },
    { value: "CONTAINER_TRACKING", label: "Container Tracking", description: "Track individual container movements" },
    { value: "BOOKING_TRACKING", label: "Booking Reference", description: "Track by booking reference number" },
    { value: "MASTER_BL", label: "Master Bill of Lading", description: "For consolidated shipments" },
    { value: "HOUSE_BL", label: "House Bill of Lading", description: "For freight forwarder shipments" },
    { value: "VESSEL_TRACKING", label: "Vessel Tracking", description: "Track vessel location and schedule" }
  ];

  // Shipping lines from your API data
  const shippingLines = [
    { name: "ACL", keyname: "ACL" },
    { name: "ANL", keyname: "ANL" },
    { name: "APL", keyname: "APL" },
    { name: "Arkas", keyname: "ARKAS" },
    { name: "CMA CGM", keyname: "CMA-CGM" },
    { name: "CNC", keyname: "CNC" },
    { name: "COSCO", keyname: "COSCO" },
    { name: "Crowley", keyname: "CROWLEY" },
    { name: "CULines", keyname: "CULINES" },
    { name: "Emirates Shipping Line", keyname: "EMIRATES-SHIPPING-LINE" },
    { name: "Evergreen", keyname: "EVERGREEN" },
    { name: "Gold Star", keyname: "GOLD-STAR" },
    { name: "Grimaldi", keyname: "GRIMALDI" },
    { name: "Hamburg Sud", keyname: "HAMBURG-SUD" },
    { name: "Hapag-Lloyd", keyname: "HAPAG-LLOYD" },
    { name: "HMM", keyname: "HMM" },
    { name: "Kambara Kisen", keyname: "KAMBARA-KISEN" },
    { name: "KMTC", keyname: "KMTC" },
    { name: "Maersk", keyname: "MAERSK" },
    { name: "Matson", keyname: "MATSON" },
    { name: "Messina", keyname: "MESSINA" },
    { name: "MSC", keyname: "MSC" },
    { name: "Namsung", keyname: "NAMSUNG" },
    { name: "One", keyname: "ONE" },
    { name: "OOCL", keyname: "OOCL" },
    { name: "PIL", keyname: "PIL" },
    { name: "RCL", keyname: "RCL" },
    { name: "Safmarine", keyname: "SAFMARINE" },
    { name: "Samskip", keyname: "SAMSKIP" },
    { name: "SCI", keyname: "SCI" },
    { name: "Seaboard Marine", keyname: "SEABOARD-MARINE" },
    { name: "Sealand", keyname: "SEALAND" },
    { name: "SeaLead", keyname: "SEALEAD" },
    { name: "Seth Shipping", keyname: "SETH-SHIPPING" },
    { name: "SITC", keyname: "SITC" },
    { name: "SM Line", keyname: "SM-LINE" },
    { name: "Tropical", keyname: "TROPICAL" },
    { name: "Turkon", keyname: "TURKON" },
    { name: "Wan Hai", keyname: "WAN-HAI" },
    { name: "WEC Lines", keyname: "WEC-LINES" },
    { name: "Westwood Shipping Lines", keyname: "WESTWOOD-SHIPPING-LINES" },
    { name: "Yang Ming", keyname: "YANG-MING" },
    { name: "ZIM", keyname: "ZIM" }
  ];

  // Initialize containers from order data
  useEffect(() => {
    if (order?.shippingContainers && order.shippingContainers.length > 0) {
      setContainers([...order.shippingContainers]);
    } else {
      // Start with one empty container
      setContainers([createEmptyContainer()]);
    }
  }, [order]);

  // Create empty container template
  const createEmptyContainer = () => ({
    containerNumber: '',
    shippingLine: '',
    trackingMethod: '' // No default - user must choose
  });

  // Add new container
  const addContainer = () => {
    setContainers([...containers, createEmptyContainer()]);
  };

  // Remove container
  const removeContainer = (index) => {
    if (containers.length > 1) {
      const newContainers = containers.filter((_, i) => i !== index);
      setContainers(newContainers);
    }
  };

  // Update container field
  const updateContainer = (index, field, value) => {
    const newContainers = [...containers];
    newContainers[index] = {
      ...newContainers[index],
      [field]: value
    };
    setContainers(newContainers);
  };

  // Validate containers
  const validateContainers = () => {
    const errors = [];
    
    containers.forEach((container, index) => {
      if (!container.containerNumber?.trim()) {
        errors.push(`Container ${index + 1}: Container Number is required`);
      }
      
      if (!container.shippingLine?.trim()) {
        errors.push(`Container ${index + 1}: Shipping Line is required`);
      }

      if (!container.trackingMethod?.trim()) {
        errors.push(`Container ${index + 1}: Tracking Method is required`);
      }

      if (container.containerNumber && container.containerNumber.trim().length < 4) {
        errors.push(`Container ${index + 1}: Container Number must be at least 4 characters`);
      }
    });

    // Check for duplicate container numbers
    const containerNumbers = containers
      .map(c => c.containerNumber?.trim().toUpperCase())
      .filter(Boolean);
    
    const duplicates = containerNumbers.filter((num, index) => 
      containerNumbers.indexOf(num) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate container numbers: ${[...new Set(duplicates)].join(', ')}`);
    }

    return errors;
  };

  // Save containers to Firebase
  const saveContainers = async () => {
    setError('');
    setSuccess('');

    // Validate containers
    const validationErrors = validateContainers();
    if (validationErrors.length > 0) {
      setError(validationErrors.join('; '));
      return;
    }

    // Filter out empty containers
    const validContainers = containers.filter(container => 
      container.containerNumber?.trim() && container.shippingLine?.trim() && container.trackingMethod?.trim()
    );

    if (validContainers.length === 0) {
      setError('Please add at least one container with Container Number, Shipping Line, and Tracking Method');
      return;
    }

    setSaving(true);

    try {
      const orderRef = doc(db, 'orders', order.id);
      
      // Prepare containers for saving
      const containersToSave = validContainers.map(container => ({
        containerNumber: container.containerNumber.trim(),
        shippingLine: container.shippingLine.trim(),
        trackingMethod: container.trackingMethod.trim()
      }));

      // Update the order document with shipping containers
      await updateDoc(orderRef, {
        shippingContainers: containersToSave,
        updatedAt: new Date()
      });

      setSuccess(`Successfully saved ${containersToSave.length} shipping container(s)`);
      
      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }

      // Auto-close after successful save
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 1500);

    } catch (err) {
      console.error('Error saving shipping containers:', err);
      setError('Failed to save shipping containers. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl   overflow-y-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-blue-600" />
            Manage Shipping Containers
            <Badge variant="outline" className="ml-2">
              {order?.poNumber || order?.id}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Success/Error Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Order Information */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">PO Number:</span> {order?.poNumber || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Customer:</span> {
                    typeof order?.customerInfo === 'string' 
                      ? order.customerInfo 
                      : order?.customerInfo?.companyName?.companyName || order?.customerInfo?.companyName || 'N/A'
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Containers List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Shipping Containers ({containers.length})
              </h3>
              <Button onClick={addContainer} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Container
              </Button>
            </div>

            {containers.map((container, index) => (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Container #{index + 1}
                    </CardTitle>
                    {containers.length > 1 && (
                      <Button
                        onClick={() => removeContainer(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    {/* Container Number */}
                    <div className="space-y-2">
                      <Label htmlFor={`container-${index}`}>
                        Container Number *
                      </Label>
                      <Input
                        id={`container-${index}`}
                        type="text"
                        placeholder="e.g., PCIU1027520"
                        value={container.containerNumber}
                        onChange={(e) => updateContainer(index, 'containerNumber', e.target.value)}
                        className="font-mono"
                      />
                    </div>

                    {/* Shipping Line */}
                    <div className="space-y-2">
                      <Label htmlFor={`shipping-line-${index}`}>
                        Shipping Line *
                      </Label>
                      <Select
                        value={container.shippingLine}
                        onValueChange={(value) => updateContainer(index, 'shippingLine', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select shipping line..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {shippingLines.map((line) => (
                            <SelectItem key={line.keyname} value={line.keyname}>
                              {line.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tracking Method */}
                    <div className="space-y-2">
                      <Label htmlFor={`tracking-method-${index}`}>
                        Tracking Method *
                      </Label>
                      <Select
                        value={container.trackingMethod}
                        onValueChange={(value) => updateContainer(index, 'trackingMethod', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tracking method..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {trackingMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{method.label}</span>
                                <span className="text-xs text-gray-500">{method.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Preview */}
                  {container.containerNumber && container.shippingLine && container.trackingMethod && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <div className="text-sm text-gray-600">
                        <strong>Preview:</strong> {container.containerNumber} via {
                          shippingLines.find(line => line.keyname === container.shippingLine)?.name || container.shippingLine
                        } using {
                          trackingMethods.find(method => method.value === container.trackingMethod)?.label || container.trackingMethod
                        }
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={saveContainers}
              className="flex-1"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Containers
                </>
              )}
            </Button>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>Summary:</strong> {containers.filter(c => c.containerNumber && c.shippingLine && c.trackingMethod).length} of {containers.length} containers have complete information
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingContainersManager;