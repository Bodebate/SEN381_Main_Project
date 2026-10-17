// Copied from the Angular mock data (views/src/app/core/api/mock/mock-seed.ts) so ids and names match.
module.exports = {
    departments: [
        { id: 'dep-water', name: 'Water', isActive: true },
        { id: 'dep-roads', name: 'Roads', isActive: true },
        { id: 'dep-elec', name: 'Electricity', isActive: true },
        { id: 'dep-parks', name: 'Parks', isActive: true },
        { id: 'dep-waste', name: 'Waste', isActive: true },
    ],
    categories: [
        { id: 'cat-sanitation', name: 'Water / sanitation', departmentId: 'dep-water', defaultSecurityLevel: 2, slaDays: 3, isActive: true },
        { id: 'cat-supply', name: 'Water supply', departmentId: 'dep-water', defaultSecurityLevel: 1, slaDays: 5, isActive: true },
        { id: 'cat-potholes', name: 'Potholes & road damage', departmentId: 'dep-roads', defaultSecurityLevel: 1, slaDays: 7, isActive: true },
        { id: 'cat-lights', name: 'Streetlights', departmentId: 'dep-elec', defaultSecurityLevel: 1, slaDays: 5, isActive: true },
        { id: 'cat-outage', name: 'Power outage', departmentId: 'dep-elec', defaultSecurityLevel: 2, slaDays: 2, isActive: true },
        { id: 'cat-trees', name: 'Trees & parks', departmentId: 'dep-parks', defaultSecurityLevel: 0, slaDays: 10, isActive: true },
        { id: 'cat-waste', name: 'Waste collection', departmentId: 'dep-waste', defaultSecurityLevel: 0, slaDays: 3, isActive: true },
    ],
};
