# PR: order history and editing endpoints

Adds three endpoints to the orders service:

- `GET /orders?page=N` lists the signed-in user's orders, 20 per page, with `hasNext` for the client's "Next" button.
- `PATCH /orders/:id` lets the owner change the shipping address of an order that has not shipped. Admins can edit any order.
- `POST /orders/:id/confirm` reserves stock for every item and then marks the order confirmed.

Tested by hand against the dev database.
