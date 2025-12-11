import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roomData: RoomData) => Promise<void>;
}

export interface RoomData {
  name: string;
  description?: string;
  type: 'public' | 'private' | 'travel_partner';
  destination?: {
    country: string;
    city?: string;
    region?: string;
  };
}

const CreateRoomDialog: React.FC<CreateRoomDialogProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<RoomData>({
    name: '',
    description: '',
    type: 'public',
    destination: undefined
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Failed to create room:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      type: 'public',
      destination: undefined
    });
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name.startsWith('destination.')) {
      const field = name.split('.')[1] as 'country' | 'city' | 'region';
      setFormData(prev => {
        const newDestination = {
          country: prev.destination?.country || '',
          city: prev.destination?.city || '',
          region: prev.destination?.region || ''
        };
        newDestination[field] = value;
        
        // Only include destination if country has a value
        return {
          ...prev,
          destination: newDestination.country ? newDestination : undefined
        };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Chat Room</DialogTitle>
          <DialogDescription>
            Set up a new chat room for your community or travel group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter room name"
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the purpose of this room"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Room Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'public' | 'private' | 'travel_partner') =>
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select room type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="travel_partner">Travel Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label>Destination</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="destination.country"
                  value={formData.destination?.country || ''}
                  onChange={handleInputChange}
                  placeholder="Country"
                  required={formData.type === 'travel_partner'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="destination.city"
                  value={formData.destination?.city || ''}
                  onChange={handleInputChange}
                  placeholder="City"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  name="destination.region"
                  value={formData.destination?.region || ''}
                  onChange={handleInputChange}
                  placeholder="Region (optional)"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomDialog;