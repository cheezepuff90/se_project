#include <iostream>
#include <vector>
#include <memory>
#include <stdexcept>

template<typename T>
class Stack {
    struct Node {
        T data;
        std::shared_ptr<Node> next;
        explicit Node(T val) : data(std::move(val)), next(nullptr) {}
    };
    std::shared_ptr<Node> top_;
    size_t size_;
public:
    Stack() : top_(nullptr), size_(0) {}

    void push(T value) {
        auto node = std::make_shared<Node>(std::move(value));
        node->next = top_;
        top_ = node;
        ++size_;
    }

    T pop() {
        if (empty()) throw std::underflow_error("Stack is empty");
        T val = top_->data;
        top_ = top_->next;
        --size_;
        return val;
    }

    const T& peek() const {
        if (empty()) throw std::underflow_error("Stack is empty");
        return top_->data;
    }

    bool empty() const { return size_ == 0; }
    size_t size() const { return size_; }
};