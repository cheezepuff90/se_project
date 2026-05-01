import java.util.*;

public class BinarySearchTree<T extends Comparable<T>> {
    private Node<T> root;

    private static class Node<T> {
        T data;
        Node<T> left, right;
        Node(T data) { this.data = data; }
    }

    public void insert(T value) {
        root = insertRec(root, value);
    }

    private Node<T> insertRec(Node<T> node, T value) {
        if (node == null) return new Node<>(value);
        int cmp = value.compareTo(node.data);
        if (cmp < 0) node.left = insertRec(node.left, value);
        else if (cmp > 0) node.right = insertRec(node.right, value);
        return node;
    }

    public boolean search(T value) {
        Node<T> curr = root;
        while (curr != null) {
            int cmp = value.compareTo(curr.data);
            if (cmp == 0) return true;
            curr = cmp < 0 ? curr.left : curr.right;
        }
        return false;
    }

    public List<T> inOrder() {
        List<T> result = new ArrayList<>();
        inOrderRec(root, result);
        return result;
    }

    private void inOrderRec(Node<T> node, List<T> result) {
        if (node != null) {
            inOrderRec(node.left, result);
            result.add(node.data);
            inOrderRec(node.right, result);
        }
    }
}