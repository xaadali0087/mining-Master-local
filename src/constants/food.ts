export interface FoodItem {
    id: number;
    name: string;
    icon: string;
    gemChance: number;
    price: number;
}

export const FOOD_ITEMS: FoodItem[] = [
    {
        id: 0,
        name: "Apple",
        icon: "🍎",
        gemChance: 5,
        price: 0
    },
    {
        id: 1,
        name: "Coffee",
        icon: "☕",
        gemChance: 20,
        price: 4
    },
    {
        id: 2,
        name: "Sandwich",
        icon: "🥪",
        gemChance: 25,
        price: 7
    },
    {
        id: 3,
        name: "Fries",
        icon: "🍟",
        gemChance: 27,
        price: 10
    },
    {
        id: 4,
        name: "Burger",
        icon: "🍔",
        gemChance: 30,
        price: 15
    },
    {
        id: 5,
        name: "Cake",
        icon: "🍰",
        gemChance: 35,
        price: 20
    },
    {
        id: 6,
        name: "Pizza",
        icon: "🍕",
        gemChance: 40,
        price: 22.5
    },
    {
        id: 7,
        name: "Salad",
        icon: "🥗",
        gemChance: 45,
        price: 25
    },
    {
        id: 8,
        name: "Noodles",
        icon: "🍜",
        gemChance: 50,
        price: 27.5
    },
    {
        id: 9,
        name: "Fried Shrimp",
        icon: "🍤",
        gemChance: 52,
        price: 30
    },
    {
        id: 10,
        name: "Stew",
        icon: "🍲",
        gemChance: 55,
        price: 35
    },
    {
        id: 11,
        name: "Steak",
        icon: "🥩",
        gemChance: 60,
        price: 40
    },
    {
        id: 12,
        name: "Dango",
        icon: "🍡",
        gemChance: 45,
        price: 0
    }
];
