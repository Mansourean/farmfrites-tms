export const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'fileText' },
  { value: 'number', label: 'Number', icon: 'grid' },
  { value: 'date', label: 'Date', icon: 'calendar' },
  { value: 'dropdown', label: 'Dropdown', icon: 'list' },
  { value: 'checkbox', label: 'Checkbox', icon: 'checkSquare' },
]

// Order matches the coordinator's actual workflow: Sales No/Customer/Destination arrive from
// Sales first; Requested Delivery Date is confirmed with the customer right after, which is
// also what the Loading Date suggestion depends on (see suggestedDispatchDate); Transporter is
// chosen once the delivery date is confirmed; Driver is filled in later still (by the
// transporter, via the assignment link -- shows blank, no alert, until then -- see
// SystemCell.jsx), so it sits right after Transporter and right before Loading Date. Plate No/
// Driver Phone stay hidden by default -- still a click away inside the trip panel.
export const DEFAULT_COLUMNS = [
  { id: 'salesNo', label: 'Sales No', icon: 'fileText', width: 116, system: true, visible: true },
  { id: 'origin', label: 'Customer', icon: 'building', width: 180, system: true, visible: true },
  { id: 'destination', label: 'Destination', icon: 'mapPin', width: 200, system: true, visible: true },
  { id: 'deliveryDate', label: 'Requested Delivery Date', icon: 'calendar', width: 168, system: true, visible: true },
  { id: 'transporter', label: 'Transporter', icon: 'truck', width: 168, system: true, visible: true },
  { id: 'driver', label: 'Driver', icon: 'userCircle', width: 168, system: true, visible: true },
  { id: 'dispatchDate', label: 'Loading Date', icon: 'calendar', width: 116, system: true, visible: true },
  { id: 'status', label: 'Status', icon: 'flag', width: 122, system: true, visible: true },
  { id: 'remarks', label: 'Remarks', icon: 'fileText', width: 200, system: true, visible: true },
  { id: 'plateNo', label: 'Plate No', icon: 'link', width: 104, system: true, visible: false },
  { id: 'driverPhone', label: 'Driver Phone', icon: 'userCircle', width: 148, system: true, visible: false },
  { id: 'vehicleType', label: 'Vehicle', icon: 'truck', width: 160, system: true, visible: false },
]
